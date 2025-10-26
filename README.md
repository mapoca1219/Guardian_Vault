Guardian Vault: Technical Deep Dive
1. The Central Tech Stack: A Three-Layer Architecture
The project is designed as a three-part modular system to maximize security and functionality:

Frontend (Angular): This is the application the user sees. It's an Angular app that runs entirely on the client-side (in your browser).

Key Function: Security comes first. The user's private key (the "seed phrase") is generated and stored encrypted only on the user's device. The frontend is the actual wallet. It never sends the private key to any server. It is 100% self-custody.

How it connects: It talks directly to the blockchain (the smart contracts) to sign and send transactions.

Blockchain (Solidity): This is the immutable "layer of truth" that lives on the blockchain (e.g., Ethereum or an L2).

Key Function: It contains the central logic for security and liquidity in smart contracts. There are two main ones:

VaultContract.sol: Manages all the social recovery logic. It keeps the registry of who your guardians are and which address is the current owner.

LoanContract.sol: Manages the liquidity pool for the loans. This contract is the one that actually holds the funds (in PYUSD) and has the logic to release them instantly once the VaultContract confirms a recovery has been initiated.

Backend (Go): This is a non-custodial support server. It has no access to your keys or your funds.

Key Function: It acts as an "orchestrator" for tasks that are impractical to do on the frontend. There are two services:

indexer_service: Monitors the blockchain (using Etherscan/Covalent APIs) to track all transactions from connected wallets. It collects and organizes this data so the "Tax Report" feature (Pillar 3) is fast and doesn't require the user to wait.

defi_helper_service: This is the brain behind the future "AI Security Assistant."

2. How the Pieces Fit Together: The Emergency Loan Flow
This flow shows how the three layers interact:

The Crisis: You lose your phone.

Step 1 (Frontend): You open the Guardian Vault app (Angular) on your laptop. You click "Initiate Recovery." The app notifies your guardians to confirm.

Step 2 (Blockchain): Your guardians interact (via their frontends) with the VaultContract.sol to approve the recovery.

Step 3 (Blockchain): The VaultContract.sol registers the approvals and emits an event: "Recovery Approved! Initiating 48h time-lock." This same event unlocks your credit line in the LoanContract.sol.

Step 4 (Frontend + Blockchain): In your Angular app, you now see a button to "Use Emergency Loan." When you click it, the frontend signs a transaction to call the LoanContract.sol.

Step 5 (Blockchain + PYUSD): The LoanContract.sol verifies that your recovery is active and instantly transfers 200 PYUSD to your Vault address.

Result: You now have liquid funds (PYUSD) in your recovered wallet to pay for that hotel, all while the 48-hour time-lock for your main assets is still running.

3. Key Partner Technologies and Their Benefits
PYUSD (PayPal USD): This is the most crucial technology partner.

Benefit: The problem with an emergency loan is that it must be useful in the real world. Using a volatile asset like ETH would be useless if its price drops 20% before you can use it. PYUSD provides stability (1:1 with USD), speed, and trust, ensuring the $200 you borrow is exactly $200 when you receive and use it.

Etherscan / Covalent:

Benefit: They allow the Go backend to read blockchain history efficiently. Without them, the project would have to run a full archive node (extremely expensive and slow) just to power the tax feature.

Aave (Potential):

Benefit: The contracts are "composable." This means the LoanContract.sol doesn't need to have its own million-dollar pool. It could integrate with a massive lending protocol like Aave to get the liquidity from there, making the business model infinitely more scalable.

4. The Notable "Hack": Transaction Simulation
The smartest "hack" in the project (mentioned in the future vision and pitch.txt) is the defi_helper_service.

Here is how the AI Security Assistant works: when you want to execute a risky DeFi transaction, the Go backend intercepts it. Before you sign it with your real key, the backend "simulates" the transaction on a private copy of the blockchain. Then, it checks the result: "What happened? Did you lose all your funds? Did you give this website infinite permission?"

It then reports back to the Angular frontend in plain language: "DANGER! If you sign this, you will give this contract permission to spend all your PYUSD." This proactive simulation is a professional-grade security feature that prevents scams before they happen.

About
ETHOnline 2025 proyect

Resources
 Readme
 Activity
Stars
 0 stars
Watchers
 0 watching
Forks
 0 forks
Report repository
Releases
No releases published
Packages
No packages published
Footer
© 2025 GitHub, Inc.
Footer navigation


# Guardian Vault

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.2.1.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

