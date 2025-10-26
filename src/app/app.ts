import { ChangeDetectionStrategy, Component, signal, computed, OnDestroy, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ethers, Contract, BrowserProvider, Signer, Provider, parseUnits, formatUnits } from 'ethers';

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface Guardian {
  id: number;
  name: string;
  avatarUrl: string;
  status: 'active' | 'pending';
  contact: string;
}

interface Transaction {
  id: string;
  txId: string;
  category: 'Ganancia de Capital' | 'Ingreso por Servicios' | 'Staking' | 'Compra' | 'Transferencia' | 'Préstamo' | 'Reembolso' | 'Aporte de Liquidez' | 'Pago';
  asset: string;
  amount: number;
  usdValue: number;
  date: string;
  costBasis?: number;
  gainLoss?: number;
  walletSource: 'Guardian Vault' | 'MetaMask';
  categorizedByAI?: boolean;
}

interface Wallet {
  btc: number;
  eth: number;
  pyusd: number;
}

interface SimulationRequest {
  from: string;
  to: string;
  data: string;
  value: string;
}

interface SimulationResponse {
  risk_level: 'BAJO' | 'MEDIO' | 'ALTO';
  analysis: string[];
  expected_changes: {
    asset: string;
    amount: string;
    from: string;
    to: string;
  }[];
}

// --- CONFIGURACIÓN DE CONTRATOS Y BACKEND ---
const PYUSD_CONTRACT_ADDRESS = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9"; // PYUSD en Sepolia
const VAULT_CONTRACT_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; // SimpleVault local
const LOAN_CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";  // SimpleLoan local
const BACKEND_API_URL = "http://localhost:8080/api/v1"; // URL del backend de Go
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 en hex

// --- ABIs (Definición de funciones del contrato) ---
// ABI para un token ERC20 -- PYUSD, necesitamos 'transfer', 'approve' y 'balanceOf'
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)"
];

// ABI para VaultContract
const VAULT_ABI = [
  "function startRecovery(address _newOwner)",
  "function approveRecovery()",
  "function addGuardian(address _guardian)",
  "function removeGuardian(address _guardian)",
  "function isGuardian(address _guardian) view returns (bool)",
  "function guardianCount() view returns (uint256)"
];

// ABI para LoanContract
const LOAN_ABI = [
  "function withdrawEmergencyLoan()",
  "function activeRecoveries(address user) view returns (bool)",
  "function fundPool(uint256 amount)"
];

@Component({
  selector: 'app-root',
  standalone: true,

  imports: [CommonModule, CurrencyPipe, DecimalPipe, FormsModule, HttpClientModule],
  template: `
    <div class="bg-gray-900 min-h-screen font-sans text-white">

      @if (currentView() === 'LOGIN') {
        <div class="flex items-center justify-center h-screen">
          <div class="w-full max-w-md p-8 space-y-8 bg-gray-800 rounded-lg shadow-lg">
            <div class="text-center">
              <h1 class="text-3xl font-bold text-cyan-400">Guardian Vault</h1>
              <p class="text-gray-400">Tu bóveda de auto-custodia.</p>
            </div>

            @if (!isLoading()) {
              <div class="space-y-4">
                <button (click)="loginAndGoToDashboard()" class="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-700 rounded-md text-white text-lg font-semibold transition-colors flex items-center justify-center space-x-2">
                  <span>Ingresar al Dashboard</span>
                </button>
                <button (click)="loginAndStartRecovery()" class="w-full py-3 px-4 bg-red-600 hover:bg-red-700 rounded-md text-white text-lg font-semibold transition-colors flex items-center justify-center space-x-2">
                  <span>Iniciar Recuperación de Cuenta</span>
                </button>
              </div>
              <p class="text-xs text-gray-500 text-center">
                Usa "Ingresar" para conectar tu wallet principal. <br/>
                Usa "Recuperación" si perdiste tu wallet y necesitas usar una nueva para iniciar el proceso.
              </p>
            } @else {
              <div class="text-center py-8">
                <p class="text-lg text-gray-300 animate-pulse">Conectando con la wallet y cargando datos...</p>
                <p class="text-sm text-gray-500 mt-2">Por favor, revisa tu extensión de MetaMask.</p>
              </div>
            }
          </div>
        </div>
      }

      @if (currentView() === 'DASHBOARD') {
        <div class="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <header class="flex justify-between items-center mb-8">
            <div>
              <h1 class="text-2xl sm:text-3xl font-bold text-cyan-400">Guardian Vault</h1>
              <p class="text-gray-400 font-mono text-xs">{{ signerAddress() }}</p>
            </div>

            <div class="relative">
              <button (click)="profileDropdownOpen.set(!profileDropdownOpen())" class="flex items-center space-x-2">
                <span class="text-sm text-gray-300">Bienvenido</span>
                 @if (isPremium()) {
                    <span class="bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">PREMIUM</span>
                 }
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              @if (profileDropdownOpen()) {
                <div class="absolute right-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-xl py-1 z-50">
                  <a (click)="openModal('PROFILE')" href="#" class="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">Perfil</a>
                  <a (click)="openModal('SETTINGS')" href="#" class="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">Configuración de Guardianes</a>
                  @if (!isPremium()) {
                    <div class="border-t border-gray-700 my-1"></div>
                    <a (click)="openModal('UPGRADE')" href="#" class="block px-4 py-2 text-sm text-yellow-400 hover:bg-gray-700 font-bold">Adquirir Plan Premium</a>
                  }
                  <div class="border-t border-gray-700 my-1"></div>
                  <a (click)="logout()" href="#" class="block px-4 py-2 text-sm text-red-400 hover:bg-gray-700">Cerrar Sesión</a>
                </div>
              }
            </div>
          </header>

          @if (recoveryState() === 'PENDING_APPROVAL') {
            <div class="bg-blue-800 border-l-4 border-blue-400 text-blue-200 p-4 rounded-lg mb-8 shadow-lg">
              <h3 class="font-bold text-lg">Recuperación Iniciada</h3>
              <p>Se ha notificado a tus guardianes. Recibirán un informe de contexto generado por IA para ayudarlos a tomar una decisión segura.</p>
            </div>
          }
          @if (recoveryState() === 'TIMELOCK') {
            <div class="bg-yellow-800 border-l-4 border-yellow-400 text-yellow-200 p-4 rounded-lg mb-8 shadow-lg animate-pulse-slow">
              <h3 class="font-bold text-lg">Recuperación en Progreso</h3>
              <p>Tus guardianes han aprobado la recuperación. Por seguridad, tu nueva wallet tendrá acceso total en:</p>
              <p class="text-2xl font-mono font-bold text-white text-center my-2">{{ formattedCountdown() }}</p>
              <p class="text-sm font-semibold">Crédito de Emergencia Disponible: <span class="text-white">{{ emergencyCreditLine().available | currency }}</span></p>
            </div>
          }

          <main class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 space-y-8">

              <section class="bg-gray-800 p-6 rounded-lg shadow-lg">
                <div class="flex justify-between items-center mb-4">
                   <h2 class="text-xl font-semibold text-gray-300">Mi Billetera</h2>
                   <button (click)="openModal('DEFI_PAYMENT')" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors flex items-center space-x-2">
                     <span>✨</span>
                     <span>Realizar Pago / Operación</span>
                   </button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                   <!-- BTC Sigue siendo simulado -->
                   <div class="bg-gray-900 p-4 rounded-lg"><p class="text-sm text-gray-400">Bitcoin (Simulado)</p><p class="text-2xl font-bold">{{ wallet().btc }} <span class="text-lg">BTC</span></p></div>
                   <!-- ETH y PYUSD se cargan desde la blockchain -->
                   <div class="bg-gray-900 p-4 rounded-lg"><p class="text-sm text-gray-400">Ethereum</p><p class="text-2xl font-bold">{{ wallet().eth | number:'1.2-5' }} <span class="text-lg">ETH</span></p></div>
                   <div class="bg-gray-900 p-4 rounded-lg"><p class="text-sm text-gray-400">PayPal USD</p><p class="text-2xl font-bold">{{ wallet().pyusd | currency:'USD' }} <span class="text-lg">PYUSD</span></p></div>
                </div>
              </section>

              <section class="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h2 class="text-xl font-semibold text-gray-300 mb-4">Actividad Consolidada</h2>
                
                <div class="space-y-3 h-96 overflow-y-auto pr-2">
                  @if (allTransactions().length === 0) {
                    <div class="text-center text-gray-500 pt-16">
                      <p>No hay historial de transacciones.</p>
                      <p class="text-sm">El historial real será cargado por el Backend Indexer.</p>
                    </div>
                  } @else {
                    @for (tx of allTransactions(); track tx.id) {
                      <div class="flex justify-between items-center bg-gray-900 p-3 rounded-md">
                        <div class="flex items-center space-x-3">
                           <div class="w-8 h-8 rounded-full flex items-center justify-center text-lg" [innerHTML]="getCategoryClass(tx.category).icon" [ngClass]="getCategoryClass(tx.category).iconBg"></div>
                          <div>
                            <p class="font-semibold flex items-center space-x-2">
                              <span>{{ tx.category }}</span>
                              @if(tx.categorizedByAI) {
                                <span class="text-xs bg-blue-500/50 text-blue-300 px-2 py-0.5 rounded-full" title="Categorizado por IA">IA</span>
                              }
                            </p>
                            <span class="text-xs px-2 py-0.5 rounded-full" [ngClass]="tx.walletSource === 'Guardian Vault' ? 'bg-cyan-800 text-cyan-300' : 'bg-orange-800 text-orange-300'">{{ tx.walletSource }}</span>
                          </div>
                        </div>
                        <div class="text-right">
                           <p class="font-bold" [ngClass]="getCategoryClass(tx.category).text">{{ tx.amount | number:'1.4-4' }} {{tx.asset}}</p>
                           <p class="text-xs text-gray-500">{{ tx.usdValue | currency:'USD':'symbol':'1.2-2' }}</p>
                        </div>
                      </div>
                    }
                  }
                </div>
              </section>
            </div>
   
            <div class="space-y-8">

               <section class="bg-gray-800 p-6 rounded-lg shadow-lg">
                  <h2 class="text-xl font-semibold mb-1 text-cyan-400">Pilar de Seguridad</h2>
                  <p class="text-sm text-gray-400 mb-4">Recuperación Social y Guardianes</p>
                
                  <div class="space-y-3 mb-4">
                    @if (guardians().length === 0) {
                      <div class="text-center text-gray-500 py-4">
                        <p>No hay guardianes configurados.</p>
                        <p class="text-sm">Necesitas leer la lista desde tu VaultContract.</p>
                      </div>
                    } @else {
                      @for (guardian of guardians(); track guardian.id) {
                          <div class="flex items-center justify-between bg-gray-900 p-3 rounded-lg">
                              <div class="flex items-center space-x-3">
                                  <img [src]="guardian.avatarUrl" class="w-8 h-8 rounded-full">
                                  <span>{{ guardian.name }}</span>
                              </div>
                              <span class="text-xs px-2 py-1 rounded-full" [ngClass]="{'bg-green-600 text-white': guardian.status === 'active', 'bg-yellow-600 text-white': guardian.status === 'pending'}">{{ guardian.status }}</span>
                          </div>
                      }
                    }
                  </div>

                  @if (recoveryState() === 'SECURE' || recoveryState() === 'RECOVERED') {
                    <button (click)="startRecovery()" [disabled]="isLoading()" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">
                       {{ isLoading() ? 'Procesando en Blockchain...' : 'Iniciar Recuperación de Cuenta' }}
                    </button>
                  } @else if (recoveryState() === 'PENDING_APPROVAL') {
                    <button (click)="approveRecovery()" [disabled]="isLoading()" class="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">
                      {{ isLoading() ? 'Procesando en Blockchain...' : 'Simular Aprobación de Guardianes' }}
                    </button>
                  }
                   @if (recoveryState() === 'RECOVERED') {
                      <p class="text-center text-green-400 mt-4 font-bold">✓ Cuenta recuperada con éxito.</p>
                  }
              </section>

              <section class="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h2 class="text-xl font-semibold mb-1 text-cyan-400">Pilar de Liquidez</h2>
                <p class="text-sm text-gray-400 mb-4">Acceso a fondos cuando los necesitas</p>
                <div class="space-y-3">
                    <button (click)="openModal('EMERGENCY_LOAN')" [disabled]="recoveryState() !== 'TIMELOCK' || isLoading()" class="w-full text-left p-4 rounded-lg transition-colors" [ngClass]="recoveryState() === 'TIMELOCK' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 opacity-50 cursor-not-allowed'">
                        <p class="font-bold">Préstamo de Emergencia</p>
                        <p class="text-sm">Disponible solo durante el time-lock.</p>
                    </button>
                    <button (click)="openModal('SOCIAL_CREDIT')" [disabled]="isLoading()" class="w-full text-left p-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:bg-gray-600">
                        <p class="font-bold">Línea de Crédito Social</p>
                        <p class="text-sm">Pide un préstamo a corto plazo para gastos.</p>
                    </button>
                </div>
              </section>

              <section class="bg-gray-800 p-6 rounded-lg shadow-lg">
                  <h2 class="text-xl font-semibold mb-1 text-cyan-400">Pilar de Cumplimiento</h2>
                  <p class="text-sm text-gray-400 mb-4">Tu centro fiscal 360°</p>
                  <div class="bg-gray-900 p-4 rounded-lg mb-4">
                    <h3 class="font-semibold text-gray-300 mb-2">Wallets Conectadas</h3>
                    <div class="space-y-2">
                      <div class="flex items-center justify-between text-sm">
                        <span class="text-cyan-400">Guardian Vault (Esta)</span>
                        <span class="text-green-400">✓ Conectada</span>
                      </div>
                      @if(metaMaskConnected()) {
                        <div class="flex items-center justify-between text-sm">
                          <span class="text-orange-400">MetaMask (0x1a2b...c3d4)</span>
                          <span class="text-green-400">✓ Conectada</span>
                        </div>
                      } @else {
                        <button (click)="openModal('CONNECT_WALLET')" class="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">
                          Conectar Wallet Externa
                        </button>
                      }
                    </div>
                  </div>
                  <button (click)="openModal('TAX_REPORT')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                      Generar Reporte Fiscal
                  </button>
              </section>
            </div>
          </main>
        </div>
      }
    </div>

    @if (activeModal() === 'PROFILE') {
      <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <div class="bg-gray-800 border border-cyan-500 text-white p-8 rounded-lg max-w-md w-full">
            <h2 class="text-2xl font-bold text-cyan-300 mb-6">Perfil de Usuario</h2>
            <div class="space-y-4">
                <div><p class="text-sm text-gray-400">Nombre</p><p>Usuario {{ signerAddress().slice(0,6) }}...{{ signerAddress().slice(-4) }}</p></div>
                <div><p class="text-sm text-gray-400">Wallet</p><p class="font-mono text-xs">{{ signerAddress() }}</p></div>
                <div><p class="text-sm text-gray-400">Miembro Desde</p><p>15 de Octubre, 2025</p></div>
                <div><p class="text-sm text-gray-400">Plan Actual</p>
                  <p class="font-bold" [ngClass]="isPremium() ? 'text-yellow-400' : 'text-gray-300'">
                    {{ isPremium() ? 'Premium' : 'Básico' }}
                  </p>
                </div>
            </div>
            <button (click)="activeModal.set(null)" class="w-full mt-8 bg-cyan-600 hover:bg-cyan-700 font-bold py-2 px-6 rounded-lg">Cerrar</button>
        </div>
      </div>
    }

    @if (activeModal() === 'SETTINGS') {
      <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <div class="bg-gray-800 border border-cyan-500 text-white p-8 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 class="text-2xl font-bold text-cyan-300 mb-6">Gestionar Guardianes</h2>
            <div class="space-y-3 mb-6">
             
                @if (guardians().length === 0) {
                  <div class="text-center text-gray-500 py-4">
                    <p>No hay guardianes configurados.</p>
                  </div>
                } @else {
                  @for (guardian of guardians(); track guardian.id) {
                      <div class="flex items-center justify-between bg-gray-900 p-3 rounded-lg">
                          <div class="flex items-center space-x-3">
                              <img [src]="guardian.avatarUrl" class="w-10 h-10 rounded-full">
                              <div>
                                <p>{{ guardian.name }}</p>
                                <p class="text-xs text-gray-500 font-mono">{{ guardian.contact }}</p>
                              </div>
                          </div>
                          <button (click)="removeGuardian(guardian.id)" class="text-red-400 hover:text-red-600 font-bold">Eliminar</button>
                      </div>
                  }
                }
            </div>
            <div class="border-t border-gray-700 pt-6">
              <h3 class="text-lg font-semibold mb-4">Añadir Nuevo Guardián</h3>
              <form (submit)="addGuardian(newName.value, newContact.value); guardianForm.reset()" #guardianForm="ngForm" class="space-y-4">
                  <input #newName="ngModel" ngModel name="newName" type="text" placeholder="Nombre del guardián" class="w-full bg-gray-700 p-2 rounded-md" required>
                  <input #newContact="ngModel" ngModel name="newContact" type="text" placeholder="Email o Dirección 0x..." class="w-full bg-gray-700 p-2 rounded-md" required>
                
                  <button type="submit" [disabled]="guardianForm.invalid || isLoading()" class="w-full bg-green-600 hover:bg-green-700 font-bold py-2 px-6 rounded-lg disabled:bg-gray-600">
                    {{ isLoading() ? 'Guardando en Blockchain...' : 'Añadir Guardián' }}
                  </button>
              </form>
            </div>
             <button (click)="activeModal.set(null)" class="w-full mt-8 bg-gray-600 hover:bg-gray-700 py-2 rounded-lg">Cerrar</button>
        </div>
      </div>
    }
    
    @if (activeModal() === 'UPGRADE') {
      <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <div class="bg-gray-800 border border-yellow-500 text-white p-8 rounded-lg max-w-4xl w-full">
            <h2 class="text-3xl font-bold text-yellow-300 mb-4 text-center">Desbloquea Todo el Potencial de Guardian Vault</h2>
            <p class="text-gray-400 mb-8 text-center">Conviértete en Premium para obtener seguridad, liquidez y cumplimiento sin precedentes.</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div class="bg-gray-900 p-6 rounded-lg"><h3 class="text-xl font-bold">Plan Básico</h3><p class="text-gray-400 mb-4">Gratis</p><ul class="space-y-2 text-sm"><li>✓ Recuperación Social con Guardianes</li><li>✓ Préstamo de Emergencia</li><li>✓ Reporte Fiscal Básico</li></ul></div>
              <div class="bg-gray-900 p-6 rounded-lg border-2 border-yellow-500"><h3 class="text-xl font-bold text-yellow-400">Plan Premium</h3><p class="text-yellow-400 mb-4">$9.99 / mes (pagado en PYUSD)</p><ul class="space-y-2 text-sm"><li>✓ Todo lo del Plan Básico</li><li class="font-bold text-white">✓ Reporte Fiscal Consolidado (multi-wallet)</li><li class="font-bold text-white">✓ Cálculo automático de ganancias de capital</li><li class="font-bold text-white">✓ Asistente de Seguridad para Operaciones DeFi</li><li class="font-bold text-white">✓ Soporte Prioritario</li></ul></div>
            </div>

            <button (click)="upgradeToPremium()" [disabled]="isLoading()" class="w-full mt-8 bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 text-lg rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed">
              {{ isLoading() ? 'Confirmando en Blockchain...' : 'Adquirir Plan Premium' }}
            </button>
            <button (click)="activeModal.set(null)" class="w-full mt-2 text-gray-400 hover:text-white text-sm">Quizás más tarde</button>
        </div>
      </div>
    }

    @if (activeModal() === 'EMERGENCY_LOAN') {
      <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <div class="bg-gray-800 border border-green-500 text-white p-8 rounded-lg max-w-sm w-full text-center">
          <h2 class="text-2xl font-bold text-green-300 mb-2">Usar Crédito de Emergencia</h2>
          <p class="text-gray-400 mb-6">Tu línea de crédito total es de {{ emergencyCreditLine().total | currency }}.</p>
          <div class="bg-gray-900 p-4 rounded-lg mb-4">
            <p class="text-sm text-gray-400">Crédito Disponible</p>
            <p class="text-3xl font-bold">{{ emergencyCreditLine().available | currency }}</p>
          </div>
          @if (emergencyCreditLine().available > 0) {
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Monto a utilizar (PYUSD)</label>
              <input #emergencyAmount type="number" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-center text-lg" placeholder="Ej: 50">
            </div>

            <button (click)="useEmergencyCredit(emergencyAmount.value)" [disabled]="isLoading()" class="w-full mt-4 bg-green-600 hover:bg-green-700 font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">
              {{ isLoading() ? 'Confirmando en Blockchain...' : 'Utilizar Crédito' }}
            </button>
          } @else {
            <p class="text-yellow-400 my-4">Has agotado tu crédito de emergencia.</p>
            <button (click)="switchToSocialCredit()" class="w-full bg-indigo-600 hover:bg-indigo-700 font-bold py-3 px-6 rounded-lg">
              Solicitar Línea de Crédito Social
            </button>
          }
          <button (click)="activeModal.set(null)" class="w-full mt-2 text-gray-400 hover:text-white text-sm">Cerrar</button>
        </div>
      </div>
    }
  
    @if (activeModal() === 'EMERGENCY_QR') {
      <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <div class="bg-gray-800 border border-green-500 text-white p-8 rounded-lg max-w-sm w-full text-center">
          <h2 class="text-2xl font-bold text-green-300 mb-2">Pago de Emergencia</h2>
          <p class="text-gray-400 mb-6">Usa este QR para pagar. El monto ha sido añadido a tu balance.</p>
          <div class="bg-white p-4 rounded-lg">
             <img [src]="'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=pay-pyusd-' + qrAmount()" alt="Código QR de Pago">
          </div>
          <p class="text-3xl font-bold my-4">{{ qrAmount() | currency }} <span class="text-lg text-gray-400">PYUSD</span></p>
          <button (click)="activeModal.set(null)" class="w-full bg-green-600 hover:bg-green-700 font-bold py-3 px-6 rounded-lg transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    }

    @if (activeModal() === 'CONNECT_WALLET') {
      <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <div class="bg-gray-800 border border-orange-500 text-white p-8 rounded-lg max-w-lg w-full">
          <h2 class="text-2xl font-bold text-orange-300 mb-2">Conectar Wallet Externa</h2>
          <p class="text-gray-400 mb-6">Pega la dirección de tu wallet (ej. MetaMask) para consolidar tu reporte fiscal. Solo se leerá el historial público.</p>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Dirección de Wallet (0x...)</label>
            <input #walletAddress type="text" class="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 font-mono" placeholder="0x1a2b3c4d...">
          </div>
          <div class="mt-8 flex justify-end space-x-4">
            <button (click)="activeModal.set(null)" class="bg-gray-600 hover:bg-gray-700 font-bold py-2 px-6 rounded-lg">Cancelar</button>
            <button (click)="handleConnectWallet(walletAddress.value)" class="bg-orange-600 hover:bg-orange-700 font-bold py-2 px-6 rounded-lg">Conectar</button>
          </div>
        </div>
      </div>
    }

    @if (activeModal() === 'TAX_REPORT') {
      <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <div class="bg-white text-gray-800 p-6 sm:p-8 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h2 class="text-2xl font-bold text-gray-800">Reporte Fiscal 2025 (Consolidado)</h2>
              <p class="text-gray-600">Este es un resumen de tu actividad en todas las wallets conectadas.</p>
            </div>
            <button (click)="activeModal.set(null)" class="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div class="bg-gray-100 p-4 rounded-lg">
                  <h3 class="text-sm font-semibold text-gray-600">Total Ganancias de Capital</h3>
                  <p class="text-2xl font-bold text-green-600">{{ totalCapitalGain() | currency:'USD' }}</p>
              </div>
              <div class="bg-gray-100 p-4 rounded-lg">
                  <h3 class="text-sm font-semibold text-gray-600">Otros Ingresos (Staking, etc.)</h3>
                  <p class="text-2xl font-bold text-blue-600">{{ totalOtherIncome() | currency:'USD' }}</p>
              </div>
              <div class="bg-gray-100 p-4 rounded-lg">
                  <h3 class="text-sm font-semibold text-gray-600">Valor Actual Portafolio</h3>
                   <p class="text-2xl font-bold text-gray-800">~ {{ 15000 | currency:'USD' }}</p>
              </div>
          </div>
          
           <div class="overflow-x-auto mb-6">
            <table class="w-full text-left table-auto text-sm">
              <thead class="bg-gray-200">
                <tr>
                  <th class="p-3">Fecha</th><th class="p-3">Wallet Origen</th><th class="p-3">Categoría</th><th class="p-3">Activo</th>
                  <th class="p-3 text-right">Valor (USD)</th><th class="p-3 text-right">Ganancia / Pérdida</th><th class="p-3">Prueba (TxID)</th>
                </tr>
              </thead>
              <tbody>
                @if (allTransactions().length === 0) {
                  <tr>
                    <td colspan="7" class="text-center text-gray-500 p-8">
                      No hay historial de transacciones.
                    </td>
                  </tr>
                } @else {
                  @for (tx of allTransactions(); track tx.id) {
                    <tr class="border-b hover:bg-gray-50">
                      <td class="p-3">{{ tx.date }}</td>
                      <td class="p-3">
                        <span class="text-xs font-bold px-2 py-1 rounded-full" 
                              [ngClass]="tx.walletSource === 'Guardian Vault' ? 'bg-cyan-200 text-cyan-900' : 'bg-orange-200 text-orange-900'">
                              {{ tx.walletSource }}
                        </span>
                      </td>
                      <td class="p-3 font-medium">{{ tx.category }}</td><td class="p-3">{{ tx.asset }}</td>
                      <td class="p-3 text-right">{{ tx.usdValue | currency:'USD':'symbol':'1.2-2' }}</td>
                      <td class="p-3 text-right font-semibold" [ngClass]="{'text-green-600': tx.gainLoss && tx.gainLoss > 0, 'text-red-600': tx.gainLoss && tx.gainLoss < 0}">
                        {{ tx.gainLoss ? (tx.gainLoss | currency:'USD':'symbol':'1.2-2') : 'N/A' }}
                      </td>
                      <td class="p-3">
                        <a [href]="'https://etherscan.io/tx/' + tx.txId" target="_blank" class="text-blue-600 hover:underline">
                          {{ tx.txId.substring(0, 6) }}...{{tx.txId.slice(-4)}}
                        </a>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
           <div class="flex justify-between items-center">
              @if (isPremium()) {
                <button (click)="openModal('TAX_SUGGESTION')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2">
                  <span>✨</span>
                  <span>Obtener Sugerencias Fiscales IA</span>
                </button>
              } @else { <div></div> }
              <div class="space-x-4">
                  <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Exportar CSV</button>
                  <button class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Exportar PDF</button>
              </div>
          </div>
        </div>
      </div>
    }

    @if (activeModal() === 'TAX_SUGGESTION') {
        <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div class="bg-gray-800 border border-blue-500 text-white p-8 rounded-lg max-w-2xl w-full">
                <h2 class="text-2xl font-bold text-blue-300 mb-2">Sugerencia de Optimización Fiscal (IA)</h2>
                <p class="text-gray-400 mb-6">Basado en tu actividad, aquí tienes una posible estrategia:</p>
                <div class="bg-gray-900 p-6 rounded-lg">
                    <h3 class="font-semibold text-lg mb-2">Cosecha de Pérdidas Fiscales (Tax-Loss Harvesting)</h3>
                    <p class="text-gray-300">Hemos detectado que posees activos con pérdidas no realizadas que podrían usarse para compensar tus ganancias de capital.</p>
                    <p class="mt-4 text-white">
                        <span class="font-bold">Sugerencia:</span> Podrías considerar vender <span class="font-bold text-yellow-400">0.2 ETH</span> para realizar una pérdida de aproximadamente <span class="font-bold text-red-400">$250</span>. Esto podría reducir tu base imponible de ganancias de capital.
                    </p>
                    <p class="text-xs text-gray-500 mt-4">*Esto no es asesoramiento financiero o fiscal. Consulta con un profesional.*</p>
                </div>
                <button (click)="activeModal.set('TAX_REPORT')" class="w-full mt-8 bg-blue-600 hover:bg-blue-700 font-bold py-2 px-6 rounded-lg">Volver al Reporte</button>
            </div>
        </div>
    }
    
    @if (activeModal() === 'SOCIAL_CREDIT') {
      <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div class="bg-gray-800 border border-indigo-500 text-white p-8 rounded-lg max-w-lg w-full shadow-2xl">
              <h2 class="text-2xl font-bold text-indigo-300 mb-2">Solicitar Línea de Crédito Social</h2>
              <p class="text-gray-400 mb-6">Obtén liquidez para tus gastos sin vender tus activos.</p>
              <div class="space-y-4">
                  <div>
                      <label class="block text-sm font-medium text-gray-300 mb-1">Monto a solicitar (PYUSD)</label>
                      <input #socialLoanAmount type="number" class="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Ej: 500">
                  </div>
                  <div>
                      <label class="block text-sm font-medium text-gray-300 mb-1">Propósito del préstamo</label>
                      <input type="text" class="w-full bg-gray-900 border border-gray-700 rounded-lg p-2" placeholder="Ej: Compra de computador">
                  </div>
              </div>
              <p class="text-xs text-gray-500 mt-4">La solicitud será enviada a tus guardianes para co-firmar. Una vez aprobada, el monto se depositará en tu wallet.</p>
              <div class="mt-8 flex justify-end space-x-4">
                  <button (click)="activeModal.set(null)" class="bg-gray-600 hover:bg-gray-700 font-bold py-2 px-6 rounded-lg">Cancelar</button>
                  <button (click)="requestSocialCreditLoan(socialLoanAmount.value)" class="bg-indigo-600 hover:bg-indigo-700 font-bold py-2 px-6 rounded-lg">Enviar Solicitud</button>
              </div>
          </div>
      </div>
    }
    
    @if (activeModal() === 'DEFI_PAYMENT') {
       <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <div class="bg-gray-800 border border-purple-500 text-white p-8 rounded-lg max-w-2xl w-full shadow-2xl">
          
          @if (defiTxStep() === 'INPUT') {
            <h2 class="text-2xl font-bold text-purple-300 mb-2">Realizar un Pago o una Operación</h2>
            <p class="text-gray-400 mb-6">Introduce los detalles de la transacción para analizarla.</p>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Dirección de Destino o Contrato</label>
                    <input #defiAddress type="text" class="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 font-mono" placeholder="0x1a2b3c4d...">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Monto (PYUSD)</label>
                    <input #defiAmount type="number" class="w-full bg-gray-900 border border-gray-700 rounded-lg p-2" placeholder="1000">
                </div>
            </div>
             <div class="mt-8 flex justify-end space-x-4">
                <button (click)="closeDeFiModal()" class="bg-gray-600 hover:bg-gray-700 font-bold py-2 px-6 rounded-lg">Cancelar</button>
             
                <button (click)="verifyDeFiTransaction(defiAddress.value, defiAmount.value)" [disabled]="isVerifyingTx()" class="bg-purple-600 hover:bg-purple-700 font-bold py-2 px-6 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed">
                  {{ isVerifyingTx() ? 'Verificando...' : 'Verificar Transacción' }}
                </button>
            </div>
          } 
          
          @if (defiTxStep() === 'VERIFIED') {
            <h2 class="text-2xl font-bold text-purple-300 mb-2 flex items-center space-x-2"><span>✨</span><span>Asistente de Seguridad IA</span></h2>
            <p class="text-gray-400 mb-6">Análisis completado.</p>
            
            <div class="bg-gray-900 p-4 rounded-lg space-y-4">
              <div>
                <p class="text-sm text-gray-400">Puntuación de Riesgo de la Transacción</p>
                <div class="flex items-center space-x-2">
                  <span class="text-2xl font-bold" [ngClass]="{
                    'text-green-400': defiTxRisk().risk_level === 'BAJO',
                    'text-yellow-400': defiTxRisk().risk_level === 'MEDIO',
                    'text-red-400': defiTxRisk().risk_level === 'ALTO'
                  }">{{ defiTxRisk().risk_level }}</span>
                </div>
              </div>
              <ul class="text-sm space-y-2 pt-2 border-t border-gray-700">
                @for(line of defiTxRisk().analysis; track $index) {
                  <li class="flex items-center space-x-2 text-gray-300"><span class="text-xl">ℹ️</span><span>{{ line }}</span></li>
                }
              </ul>
            </div>
            
            <div class="mt-8 flex justify-end space-x-4">
              <button (click)="closeDeFiModal()" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Cancelar</button>

              <button (click)="executeDeFiTransaction()" [disabled]="isLoading()" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">
                {{ isLoading() ? 'Confirmando en Blockchain...' : 'Confirmar y Pagar' }}
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
  `]
})
export class App implements OnDestroy {

  http = inject(HttpClient);

  currentView = signal<'LOGIN' | 'DASHBOARD'>('LOGIN');
  profileDropdownOpen = signal(false);
  activeModal = signal<null | 'PROFILE' | 'SETTINGS' | 'UPGRADE' | 'EMERGENCY_LOAN' | 'EMERGENCY_QR' | 'CONNECT_WALLET' | 'TAX_REPORT' | 'SOCIAL_CREDIT' | 'DEFI_PAYMENT' | 'TAX_SUGGESTION'>(null);
  
  // --- Estados de Carga ---
  isLoading = signal(false);      // Para transacciones de blockchain
  isVerifyingTx = signal(false);  // Para llamadas al backend de Go
  
  // --- Estados de Web3 (Wallet) ---
  provider = signal<Provider | null>(null);
  signer = signal<Signer | null>(null);
  signerAddress = signal<string>("");

  isPremium = signal(false);
  
  recoveryState = signal<'SECURE' | 'PENDING_APPROVAL' | 'TIMELOCK' | 'RECOVERED'>('SECURE');
  timelockCountdown = signal(48 * 60 * 60);
  private timelockInterval: any;
  
  wallet = signal<Wallet>({ btc: 0, eth: 0, pyusd: 0 });
  
  guardians = signal<Guardian[]>([
    { id: 1, name: 'Guardian 1', contact: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', status: 'active', avatarUrl: 'https://placehold.co/40x40/blue/white?text=G1' },
    { id: 2, name: 'Guardian 2', contact: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', status: 'active', avatarUrl: 'https://placehold.co/40x40/green/white?text=G2' }
  ]);

  internalTransactions = signal<Transaction[]>([]);
  metaMaskConnected = signal(false);
  externalTransactions = signal<Transaction[]>([]);
  
  qrAmount = signal(0);
  emergencyCreditLine = signal({ total: 200, available: 200 });
  
  defiTxStep = signal<'INPUT' | 'VERIFIED'>('INPUT');
  defiTxRisk = signal<SimulationResponse>({ risk_level: 'BAJO', analysis: [], expected_changes: [] });
  defiTransactionAddress = signal<string>(''); 
  defiTransactionAmount = signal<string>('');
  
  allTransactions = computed(() => {
    const all = [...this.internalTransactions(), ...this.externalTransactions()];
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });
  formattedCountdown = computed(() => {
    const totalSeconds = this.timelockCountdown();
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });
  totalCapitalGain = computed(() => this.allTransactions().reduce((sum, tx) => sum + (tx.gainLoss ?? 0), 0));
  totalOtherIncome = computed(() => this.allTransactions().filter(tx => tx.category === 'Staking' || tx.category === 'Ingreso por Servicios').reduce((sum, tx) => sum + tx.usdValue, 0));

  ngOnDestroy() { this.stopTimelock(); }

  /**
   * Paso 1: Conecta la wallet (MetaMask o Dummy)
   * Esta es la función central de autenticación.
   */
  async connectWallet() {
    this.isLoading.set(true);
    
    try {
      if (!window.ethereum) {
        this.showError("MetaMask no detectado. Por favor instala MetaMask.");
        this.isLoading.set(false);
        return false;
      }

      // Cambiar a Sepolia
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }]
      });

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      this.provider.set(provider);
      this.signer.set(signer);
      this.signerAddress.set(address);
      
      await this.loadRealWalletBalances();
      
      this.isLoading.set(false);
      return true;

    } catch (error) {
      console.error("Error:", error);
      this.showError("Error conectando MetaMask. Asegúrate de estar en la red local.");
      this.isLoading.set(false);
      return false;
    }
  }
  
  async loadRealWalletBalances() {
    if (!this.provider() || !this.signerAddress()) return;
    
    console.log("Cargando balances reales...");
    console.log("Dirección:", this.signerAddress());
    console.log("PYUSD Contract:", PYUSD_CONTRACT_ADDRESS);
    
    try {
      // 1. Verificar red
      const network = await this.provider()!.getNetwork();
      console.log("Red actual:", network.chainId, network.name);
      
      // 2. Cargar Balance de ETH
      const ethBalance = await this.provider()!.getBalance(this.signerAddress());
      console.log("ETH Balance:", formatUnits(ethBalance, 18));
      
      // 3. Cargar Balance de PYUSD
      const pyusdContract = new Contract(PYUSD_CONTRACT_ADDRESS, ERC20_ABI, this.provider());
      const pyusdBalance = await pyusdContract['balanceOf'](this.signerAddress());
      console.log("PYUSD Balance:", formatUnits(pyusdBalance, 6));
      
      // 4. Actualizar el signal de la wallet
      this.wallet.update(w => ({
        ...w,
        eth: parseFloat(formatUnits(ethBalance, 18)),
        pyusd: parseFloat(formatUnits(pyusdBalance, 6))
      }));
      console.log("Balances cargados exitosamente");

    } catch (error) {
      console.error("Error detallado:", error);
      this.showError("Error: " + (error as any).message);
    }
  }

  async loginAndGoToDashboard() {
    const success = await this.connectWallet();
    if (success) {
      this.currentView.set('DASHBOARD');
    }
  }

  async loginAndStartRecovery() {
    const success = await this.connectWallet();
    if (success) {
      await this.startRecovery();
    }
  }

  logout() {
    this.profileDropdownOpen.set(false);
    this.currentView.set('LOGIN');
    this.activeModal.set(null);
    this.isPremium.set(false);
    this.recoveryState.set('SECURE');
    this.metaMaskConnected.set(false);
    this.externalTransactions.set([]);
    this.guardians.set([]);
    this.wallet.set({ btc: 0, eth: 0, pyusd: 0 });
    this.emergencyCreditLine.set({ total: 200, available: 200 });
    this.provider.set(null);
    this.signer.set(null);
    this.signerAddress.set("");
  }
  
  openModal(modal: any) {
    this.activeModal.set(modal);
    this.profileDropdownOpen.set(false);
  }

  removeGuardian(guardianId: number) {
    // TAREA: Esta función ahora es una simulación.
    // 
    // 1. Obtener la dirección del guardián (no solo el ID).
    // 2. Llamar a una función `removeGuardian(address _guardian)` en VaultContract.
    // 3. Esperar a tx.wait().
    // 4. Volver a cargar la lista de guardianes desde el contrato.
    this.guardians.update(current => current.filter(g => g.id !== guardianId));
    this.showError("Simulación: Guardián eliminado localmente. Debes implementar la llamada al contrato.");
  }

  async addGuardian(name: string, contact: string) {
    if (!this.signer()) return this.showError("Wallet no conectada.");
    if (!name || !ethers.isAddress(contact)) return this.showError("Por favor, introduce un nombre y una dirección de wallet válida para el guardián.");

    this.isLoading.set(true);
    try {
      // Intentar transacción real primero
      try {
        const vaultContract = new Contract(VAULT_CONTRACT_ADDRESS, VAULT_ABI, this.signer());
        const tx = await vaultContract['addGuardian'](contact);
        await tx.wait();
        
        const newGuardian: Guardian = {
          id: Date.now(),
          name,
          contact,
          status: 'active',
          avatarUrl: `https://placehold.co/40x40/green/white?text=${name.charAt(0).toUpperCase()}`
        };
        this.guardians.update(current => [...current, newGuardian]);
        
        alert(`✅ Guardián ${name} añadido en blockchain!`);
        
      } catch (contractError) {
        console.log("Contrato no disponible, usando simulación:", contractError);
        
        // Fallback a simulación
        await new Promise(resolve => setTimeout(resolve, 1000));
        const newGuardian: Guardian = {
          id: Date.now(),
          name,
          contact,
          status: 'pending',
          avatarUrl: `https://placehold.co/40x40/orange/white?text=${name.charAt(0).toUpperCase()}`
        };
        this.guardians.update(current => [...current, newGuardian]);
        
        alert(`✅ Guardián ${name} añadido (simulación)!`);
      }

    } catch (error) {
      console.error("Error:", error);
      this.showError("Error al añadir guardián");
    }
    this.isLoading.set(false);
  }
  
  async upgradeToPremium() {
    if (!this.signer()) return this.showError("Wallet no conectada.");
    
    if (this.wallet().pyusd < 9.99) {
      this.showError("Fondos insuficientes. Necesitas al menos 9.99 PYUSD.");
      return;
    }
    
    this.isLoading.set(true);
    try {
      // Transacción real con PYUSD
      const pyusdContract = new Contract(PYUSD_CONTRACT_ADDRESS, ERC20_ABI, this.signer());
      const treasuryAddress = "0x742d35cc6634c0532925a3b8d4c9db96c4b5da5e"; // Dirección de tesorería
      const amount = parseUnits("9.99", 6); // PYUSD tiene 6 decimales
      
      const tx = await pyusdContract['transfer'](treasuryAddress, amount);
      await tx.wait();
      
      // Actualizar balances reales
      await this.loadRealWalletBalances();
      
      const premiumTx: Transaction = {
        id: `tx${Date.now()}`, txId: tx.hash, category: 'Pago', asset: 'PYUSD', amount: 9.99, usdValue: 9.99, date: new Date().toISOString().split('T')[0], walletSource: 'Guardian Vault'
      };
      this.internalTransactions.update(txs => [premiumTx, ...txs]);
      this.isPremium.set(true);
      this.activeModal.set(null);
      
      alert('✅ ¡Pago real completado! Bienvenido a Premium!');

    } catch (error) {
      console.error("Error:", error);
      this.showError("Error en transacción real: " + (error as any).message);
    }
    this.isLoading.set(false);
  }

  // --- Lógica de Recuperación y Timelock
  
  async startRecovery() { 
    if (!this.signer()) return this.showError("Wallet no conectada.");

    const newOwnerAddress = prompt("Introduce la NUEVA dirección de wallet para la recuperación:");
    if (!newOwnerAddress || !ethers.isAddress(newOwnerAddress)) {
      return this.showError("Dirección no válida.");
    }

    this.isLoading.set(true);
    try {
      // Intentar transacción real primero
      try {
        const vaultContract = new Contract(VAULT_CONTRACT_ADDRESS, VAULT_ABI, this.signer());
        const tx = await vaultContract['startRecovery'](newOwnerAddress);
        await tx.wait();
        
        this.recoveryState.set('PENDING_APPROVAL');
        this.emergencyCreditLine.set({ total: 200, available: 200 });
        
        alert('✅ Recuperación iniciada en blockchain!');
        
      } catch (contractError) {
        console.log("Contrato no disponible, usando simulación:", contractError);
        
        // Fallback a simulación
        await new Promise(resolve => setTimeout(resolve, 2000));
        this.recoveryState.set('PENDING_APPROVAL');
        this.emergencyCreditLine.set({ total: 200, available: 200 });
        
        alert('✅ Recuperación iniciada (simulación)!');
      }

    } catch (error) {
      console.error("Error:", error);
      this.showError("Error al iniciar recuperación");
    }
    this.isLoading.set(false);
  }

  async approveRecovery() { 
    if (!this.signer()) return this.showError("Wallet no conectada.");

    this.isLoading.set(true);
    try {
      // Simulación para demo
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.recoveryState.set('TIMELOCK');
      this.startTimelock();
      
      alert('✅ Guardianes han aprobado. Préstamo de emergencia activado.');

    } catch (error) {
      console.error("Error:", error);
      this.showError("Error al aprobar recuperación");
    }
    this.isLoading.set(false);
  }

  startTimelock() {
    this.stopTimelock();
    this.timelockCountdown.set(100);
    this.timelockInterval = setInterval(() => {
      this.timelockCountdown.update(val => {
        if (val > 1) { return val - 1; }
        this.stopTimelock();
        this.recoveryState.set('RECOVERED');
        return 0;
      });
    }, 1000);
  }

  stopTimelock() { if (this.timelockInterval) { clearInterval(this.timelockInterval); } }

  async useEmergencyCredit(amountStr: string) { 
    if (!this.signer()) return this.showError("Wallet no conectada.");

    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) { return this.showError("Por favor, ingresa un monto válido."); }
    if (amount > this.emergencyCreditLine().available) { return this.showError("El monto solicitado excede tu crédito de emergencia disponible."); }

    this.isLoading.set(true);
    try {
      // Simulación para demo
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.emergencyCreditLine.update(line => ({ ...line, available: line.available - amount }));
      this.wallet.update(w => ({ ...w, pyusd: w.pyusd + amount }));
      
      const loanTx: Transaction = {
          id: `tx${Date.now()}`, txId: `0x${Math.random().toString(16).substr(2, 8)}`, category: 'Préstamo', asset: 'PYUSD', amount: amount, usdValue: amount, date: new Date().toISOString().split('T')[0], walletSource: 'Guardian Vault'
      };
      this.internalTransactions.update(txs => [loanTx, ...txs]);
      this.qrAmount.set(amount);
      this.activeModal.set('EMERGENCY_QR');
      
      alert(`✅ Préstamo de emergencia de ${amount} PYUSD aprobado!`);

    } catch (error) {
      console.error("Error:", error);
      this.showError("Error al procesar préstamo");
    }
    this.isLoading.set(false);
  }
  
  switchToSocialCredit() {
    this.activeModal.set('SOCIAL_CREDIT');
  }

  async requestSocialCreditLoan(amountStr: string) {
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) { return this.showError("Por favor, ingresa un monto válido."); }
    
    this.isLoading.set(true);
    try {
      // Simulación para demo
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      this.wallet.update(w => ({ ...w, pyusd: w.pyusd + amount }));
      const loanTx: Transaction = {
            id: `tx${Date.now()}`, txId: `0x${Math.random().toString(16).substr(2, 8)}`, category: 'Préstamo', asset: 'PYUSD', amount: amount, usdValue: amount, date: new Date().toISOString().split('T')[0], walletSource: 'Guardian Vault'
        };
      this.internalTransactions.update(txs => [loanTx, ...txs]);
      this.activeModal.set(null);
      
      alert(`✅ Préstamo social de ${amount} PYUSD aprobado por tus guardianes!`);
      
    } catch (error) {
      console.error("Error:", error);
      this.showError("Error al procesar préstamo social");
    }
    this.isLoading.set(false);
  }
  
  // --- Lógica de Integraciones y DeFi ---
  
  handleConnectWallet(address: string) {
    if (!address || !address.startsWith('0x')) {
      return this.showError("Por favor, introduce una dirección de wallet válida.");
    }
    // TAREA: En lugar de simular, deberíamos:
    // 1. Llamar a tu backend de Go: 
    //    this.http.post(`${BACKEND_API_URL}/add_wallet`, { address: address }).subscribe(...)
    // 2. El backend (indexer_service) debería empezar a monitorear esa wallet.
    // 3. Al abrir el modal de TAX_REPORT, deberíamos hacer un GET
    //    a tu backend para traer las transacciones reales.
    
    // --- Simulación (borrar esto después de implementar lo de arriba) ---
    this.metaMaskConnected.set(true);
    this.externalTransactions.set([
      { id: 'etx1', txId: '0x111aaa222bbb', category: 'Staking', asset: 'ETH', amount: 0.05, usdValue: 175.00, date: '2025-09-10', walletSource: 'MetaMask' },
      { id: 'etx2', txId: '0x222bbb333ccc', category: 'Ganancia de Capital', asset: 'ETH', amount: 0.5, usdValue: 1750.00, date: '2025-08-20', costBasis: 1000.00, gainLoss: 750.00, walletSource: 'MetaMask' },
    ]);
    this.activeModal.set(null);
    this.showError("Simulación: Wallet externa conectada localmente. Debes implementar la llamada al backend indexer.");
  }
  

  verifyDeFiTransaction(address: string, amount: string) {
    if (!this.signer()) return this.showError("Wallet no conectada.");
    if (!ethers.isAddress(address) || !amount || parseFloat(amount) <= 0) {
      return this.showError("Por favor, introduce una dirección y monto válidos.");
    }

    this.isVerifyingTx.set(true);
    
    this.defiTransactionAddress.set(address);
    this.defiTransactionAmount.set(amount);

    // 1. Simular el 'calldata' para una transferencia de PYUSD
    const amountWei = parseUnits(amount, 18).toString();
    const calldata = `0xa9059cbb${ethers.zeroPadValue(address, 32).substring(2)}${ethers.zeroPadValue(ethers.toBeHex(amountWei), 32).substring(2)}`;

    const request: SimulationRequest = {
      from: this.signerAddress(),
      to: PYUSD_CONTRACT_ADDRESS, // La transacción es AL CONTRATO de PYUSD
      data: calldata,
      value: "0" // No se envía ETH, solo se llama a una función del token
    };

    // Simulación del asistente de IA
    setTimeout(() => {
      const riskLevels = ['BAJO', 'MEDIO', 'ALTO'] as const;
      const randomRisk = riskLevels[Math.floor(Math.random() * riskLevels.length)];
      
      const mockResponse: SimulationResponse = {
        risk_level: randomRisk,
        analysis: [
          'Dirección de destino verificada en la blockchain',
          'No se detectaron patrones sospechosos',
          'Monto dentro de límites normales',
          'Transacción parece legítima'
        ],
        expected_changes: [{
          asset: 'PYUSD',
          amount: `-${amount}`,
          from: this.signerAddress(),
          to: address
        }]
      };
      
      this.defiTxRisk.set(mockResponse);
      this.defiTxStep.set('VERIFIED');
      this.isVerifyingTx.set(false);
    }, 2000);
  }
  
  async executeDeFiTransaction() {
    if (!this.signer()) return this.showError("Wallet no conectada.");
    
    const toAddress = this.defiTransactionAddress();
    const amountStr = this.defiTransactionAmount();
    const amountNum = parseFloat(amountStr);

    if (this.wallet().pyusd < amountNum) {
      return this.showError("Fondos insuficientes para realizar este pago.");
    }

    this.isLoading.set(true);
    try {
      // Transacción real con PYUSD
      const pyusdContract = new Contract(PYUSD_CONTRACT_ADDRESS, ERC20_ABI, this.signer());
      const amountWei = parseUnits(amountStr, 6); // PYUSD tiene 6 decimales
      
      const tx = await pyusdContract['transfer'](toAddress, amountWei);
      await tx.wait();

      // Actualizar balances reales
      await this.loadRealWalletBalances();
      
      const newTransaction: Transaction = {
        id: `tx${Date.now()}`, txId: tx.hash, category: 'Pago', asset: 'PYUSD', amount: amountNum, usdValue: amountNum, date: new Date().toISOString().split('T')[0], walletSource: 'Guardian Vault'
      };
      this.internalTransactions.update(txs => [newTransaction, ...txs]);
      this.closeDeFiModal();
      
      alert(`✅ Pago real de ${amountNum} PYUSD enviado exitosamente!`);

    } catch (error) {
      console.error("Error:", error);
      this.showError("Error en transacción real: " + (error as any).message);
    }
    this.isLoading.set(false);
  }
  
  closeDeFiModal() {
    this.activeModal.set(null);
    this.defiTxStep.set('INPUT');
    this.isVerifyingTx.set(false);
    this.defiTransactionAddress.set('');
    this.defiTransactionAmount.set('');
  }

  getCategoryClass(cat: Transaction['category']) {
    switch (cat) {
        case 'Ganancia de Capital': return { icon: '📈', iconBg: 'bg-green-500/20', text: 'text-green-400' };
        case 'Pago': return { icon: '💳', iconBg: 'bg-red-500/20', text: 'text-red-400' };
        case 'Ingreso por Servicios': return { icon: '💼', iconBg: 'bg-blue-500/20', text: 'text-blue-400' };
        case 'Staking': return { icon: '🌱', iconBg: 'bg-teal-500/20', text: 'text-teal-400' };
        case 'Préstamo': return { icon: '🏦', iconBg: 'bg-yellow-500/20', text: 'text-yellow-400' };
        case 'Aporte de Liquidez': return { icon: '💧', iconBg: 'bg-purple-500/20', text: 'text-purple-400' };
        default: return { icon: '💸', iconBg: 'bg-gray-600/20', text: 'text-white' };
    }
  }

  showError(message: string) {
    console.error("ERROR DE USUARIO:", message);
    alert(`Error: ${message}`); 
  }
}

