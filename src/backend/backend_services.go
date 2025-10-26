package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

// --- 1. INDEXER_SERVICE (Simulación) ---

// Simula la estructura de una transacción obtenida de Etherscan/Covalent
type ApiTransaction struct {
	Hash      string `json:"hash"`
	From      string `json:"from"`
	To        string `json:"to"`
	Value     string `json:"value"`
	Timestamp int64  `json:"timeStamp"`
	Asset     string `json:"asset"`
}

// simula una llamada a la API de Etherscan
func fetchTransactionsFromAPI(walletAddress string) ([]ApiTransaction, error) {
	fmt.Printf("[Indexer Service] Buscando transacciones para: %s...\n", walletAddress)
	// En un caso real, aquí harías una llamada http.Get() a la API de Etherscan/Covalent
	// http.Get("https://api.etherscan.io/api?module=account&action=txlist...")
	
	// Devolvemos datos mock (simulados)
	mockTxs := []ApiTransaction{
		{
			Hash:      "0xabc123...",
			From:      walletAddress,
			To:        "0xdef456...",
			Value:     "100000000000000000", // 0.1 ETH
			Timestamp: time.Now().Add(-24 * time.Hour).Unix(),
			Asset:     "ETH",
		},
		{
			Hash:      "0xghi789...",
			From:      "0xjkl012...",
			To:        walletAddress,
			Value:     "500000000000000000000", // 500 PYUSD (ejemplo)
			Timestamp: time.Now().Add(-48 * time.Hour).Unix(),
			Asset:     "PYUSD",
		},
	}
	
	return mockTxs, nil
}

// Inicia el servicio de indexación en segundo plano
func startIndexerService(walletList []string) {
	log.Println("[Indexer Service] Iniciando el servicio de indexación...")
	
	// Este 'ticker' simula un 'cron job' o 'daemon' que se ejecuta cada 60 segundos
	ticker := time.NewTicker(60 * time.Second)
	
	// Ejecuta la función en un bucle infinito en una goroutine separada
	go func() {
		for range ticker.C {
			log.Println("[Indexer Service] Ejecutando ciclo de indexación...")
			for _, wallet := range walletList {
				txs, err := fetchTransactionsFromAPI(wallet)
				if err != nil {
					log.Printf("[Indexer Service] Error al buscar txs para %s: %v\n", wallet, err)
					continue
				}
				// En una aplicación real, aquí guardarías estas 'txs' en tu base de datos
				// para que el frontend (Angular) las consulte para el "Reporte Fiscal".
				log.Printf("[Indexer Service] Se encontraron %d transacciones para %s\n", len(txs), wallet)
			}
		}
	}()
}


// --- 2. DEFI_HELPER_SERVICE (Simulación) ---

// Lo que el frontend (Angular) nos enviaría para simular
type SimulationRequest struct {
	From    string `json:"from"`
	To      string `json:"to"`
	Data    string `json:"data"` // El 'calldata' de la transacción
	Value   string `json:"value"`
}

// Lo que el backend (Go) le responderá al frontend
type SimulationResponse struct {
	RiskLevel string   `json:"risk_level"` // "BAJO", "MEDIO", "ALTO"
	Analysis  string   `json:"analysis"`   // El texto en lenguaje sencillo
	Warnings  []string `json:"warnings"`
}

// El "cerebro" del Asistente de Seguridad IA (actualmente una simulación simple)
// En un caso real, esto usaría un 'fork' de la mainnet (ej. con Geth o Anvil)
// y ejecutaría la transacción para ver el cambio de estado.
func analyzeTransactionRisk(req SimulationRequest) SimulationResponse {
	log.Printf("[DeFi Helper] Analizando transacción para: %s\n", req.To)

	// Simulación de lógica de IA / Reglas de negocio
	
	// REGLA 1: ¿Es una dirección de estafa conocida?
	if strings.EqualFold(req.To, "0xBadScamContract123456789000000000000") {
		return SimulationResponse{
			RiskLevel: "ALTO",
			Analysis:  "¡PELIGRO! Esta es una dirección de estafa conocida. Rechaza esta transacción.",
			Warnings:  []string{"Dirección en lista negra"},
		}
	}

	// REGLA 2: ¿Está intentando dar un permiso 'approve' infinito?
	// '0x095ea7b3' es el hash de 'approve(address,uint256)'
	if strings.HasPrefix(req.Data, "0x095ea7b3") && strings.HasSuffix(req.Data, "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") {
		return SimulationResponse{
			RiskLevel: "MEDIO",
			Analysis:  "ADVERTENCIA: Estás a punto de dar permiso ILIMITADO a este contrato para gastar tus fondos. Asegúrate de confiar plenamente en este sitio.",
			Warnings:  []string{"Aprobación de token infinita detectada"},
		}
	}

	// REGLA 3: ¿Es una simple transferencia de PYUSD?
	// '0xa9059cbb' es el hash de 'transfer(address,uint256)'
	if strings.HasPrefix(req.Data, "0xa9059cbb") {
		return SimulationResponse{
			RiskLevel: "BAJO",
			Analysis:  "Esta es una transferencia simple de tokens. El contrato de destino parece ser seguro.",
			Warnings:  []string{},
		}
	}

	// Caso por defecto
	return SimulationResponse{
		RiskLevel: "BAJO",
		Analysis:  "La simulación de la transacción se completó con éxito. No se detectaron riesgos obvios.",
		Warnings:  []string{},
	}
}

// El 'handler' de la API que Angular llamaría
func defiSimulationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Metodo no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req SimulationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Cuerpo de solicitud invalido", http.StatusBadRequest)
		return
	}

	// Ejecuta el análisis de riesgo
	response := analyzeTransactionRisk(req)

	// Devuelve la respuesta a Angular
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}


// --- 3. FUNCIÓN PRINCIPAL (Servidor) ---

func main() {
	// Lista de wallets a monitorear (en un caso real, vendría de una DB)
	walletsToTrack := []string{
		"0x1234567890abcdef...", // Wallet del usuario Alex
		"0xabcdef1234567890...", // Su wallet de MetaMask conectada
	}
	
	// 1. Inicia el servicio de indexación en segundo plano
	startIndexerService(walletsToTrack)
	
	// 2. Expone el servicio de simulación DeFi en un endpoint de API
	http.HandleFunc("/api/v1/simulate_tx", defiSimulationHandler)

	log.Println("[Servidor Principal] Iniciando servidor en http://localhost:8080")
	log.Println("Endpoint del Asistente IA disponible en POST /api/v1/simulate_tx")
	
	// 3. Inicia el servidor web
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("Error al iniciar el servidor: %v", err)
	}
}
