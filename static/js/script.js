  // script.js

  // --- Global Variable Declarations ---
  let contract;
  let signer;
  let userAddress;

  // IMPORTANT: Replace with the actual deployed address of your ClinicalTrialManager contract
  // This MUST be the address of your LATEST DEPLOYMENT of the ClinicalTrialManager contract.
  const CONTRACT_ADDRESS = "0x2cE8a299f3e0aCc0619298872779E04b7F21c2bf"; // <-- REMEMBER TO UPDATE THIS WITH NEW CONTRACT ADDRESS

  // Global variable to store last sync times for each section
  let lastSyncTimes = {
      pendingDoctors: 0,
      allTrials: 0,
      deletedTrials: 0, // New entry for deleted trials
      registeredDoctors: 0,
      registeredPatients: 0,
      myManagedTrialsAndPatients: 0, // Added for Doctor Dashboard
      myJoinedTrials: 0 // Added for Patient Dashboard
  };

  // Global variable for trial deletion confirmation
  let trialIdToDelete = null;

  // --- General Modal DOM Elements (accessible globally) ---
  const messageModal = document.getElementById('messageModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');

  // --- Clinical Trial API Search Constants and DOM Elements (accessible globally) ---
  const API_BASE_URL = 'https://clinicaltrials.gov/api/v2/studies';
  const apiOfficialNameInput = document.getElementById('apiOfficialNameInput');
  const apiSearchButton = document.getElementById('apiSearchButton');
  const apiLoadingIndicator = document.getElementById('apiLoadingIndicator');
  const apiResultsContainer = document.getElementById('apiResultsContainer');
  const apiInitialMessage = document.getElementById('apiInitialMessage');


  // --- Helper Functions ---

  /**
   * @dev Helper function to truncate Ethereum addresses for display.
   * @param {string} address The full Ethereum address.
   * @returns {string} The truncated address with ellipsis.
   */
  function truncateAddress(address) {
      if (!address || address.length < 10) return address;
      return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }

  /**
   * @dev Shows a custom modal with a title and message.
   * @param {string} title - The title of the modal.
   * @param {string} message - The message content of the modal.
   */
  function showModal(title, message) {
      if (modalTitle && modalMessage && messageModal) {
          modalTitle.textContent = title;
          modalMessage.textContent = message;
          messageModal.style.display = 'flex'; // Use flex to center the modal
      } else {
          // Fallback to alert if modal elements are not found
          alert(`${title}\n\n${message}`);
      }
  }

  /**
   * @dev Hides the custom modal.
   */
  function hideModal() {
      if (messageModal) {
          messageModal.style.display = 'none';
      }
  }

  /**
   * @dev Displays API search results in the apiResultsContainer.
   * @param {Array} studies - An array of study objects to display.
   */
  function displayApiResults(studies) {
      if (!apiResultsContainer || !apiInitialMessage) return;

      apiResultsContainer.innerHTML = '';
      apiInitialMessage.classList.add('hidden');

      if (studies.length === 0) {
          apiResultsContainer.innerHTML = '<p class="text-center text-gray-500">No clinical trials found for this official in the API.</p>';
          return;
      }

      studies.forEach(study => {
          const studyDiv = document.createElement('div');
          studyDiv.className = 'bg-gray-50 p-4 rounded-md shadow-sm border border-gray-200';

          // Safely access nested properties with optional chaining
          const briefTitle = study.protocolSection?.identificationModule?.briefTitle || 'N/A';
          const officialTitle = study.protocolSection?.identificationModule?.officialTitle || 'N/A';
          const overallStatus = study.protocolSection?.oversightModule?.overallStatus || 'N/A';
          const briefSummary = study.protocolSection?.descriptionModule?.briefSummary || 'No brief summary available.';

          studyDiv.innerHTML = `
              <h3 class="text-xl font-semibold text-green-700 mb-2">${briefTitle}</h3>
              <p class="text-sm text-gray-600 mb-2"><strong>Official Title:</strong> ${officialTitle}</p>
              <p class="text-sm text-gray-600 mb-2"><strong>Status:</strong> <span class="font-medium text-gray-800">${overallStatus}</span></p>
              <p class="text-gray-700 text-sm line-clamp-3">${briefSummary}</p>
              ${study.idInfo?.nctId ? `<p class="text-sm text-gray-500 mt-2">NCT ID: <a href="https://clinicaltrials.gov/study/${study.idInfo.nctId}" target="_blank" class="text-blue-500 hover:underline">${study.idInfo.nctId}</a></p>` : ''}
          `;
          apiResultsContainer.appendChild(studyDiv);
      });
  }

  /**
   * @dev Updates the connection status display in the navigation bar.
   * This function is now global and used across different dashboard pages.
   */
  function updateConnectionStatus() {
      const connectedWalletElem = document.getElementById('connectedWallet');
      const statusIndicator = document.getElementById('statusIndicator');
      const connectionStatusDiv = document.getElementById('connectionStatus');

      if (connectedWalletElem && statusIndicator && connectionStatusDiv) {
          // Remove existing disconnect button to prevent duplicates
          const existingDisconnectBtn = document.getElementById('disconnectWalletBtn');
          if (existingDisconnectBtn) {
              existingDisconnectBtn.remove();
          }

          if (userAddress) {
              const displayAddress = truncateAddress(userAddress);
              connectedWalletElem.innerHTML = `Connected: <span title="${userAddress}">${displayAddress}</span>`;
              statusIndicator.classList.remove('bg-red-500');
              statusIndicator.classList.add('bg-green-500');
              statusIndicator.classList.add('animate-pulse'); // Ensure flashing for connected

              // Add Disconnect button
              const disconnectButton = document.createElement('button');
              disconnectButton.id = 'disconnectWalletBtn';
              // Changed disconnect button to red for disconnect action
              disconnectButton.className = 'ml-2 px-2 py-1 text-xs bg-red-500 hover:bg-red-600 rounded';
              disconnectButton.textContent = 'Disconnect';
              disconnectButton.onclick = disconnectWallet;
              connectionStatusDiv.appendChild(disconnectButton);
          } else {
              connectedWalletElem.textContent = `Disconnected`;
              statusIndicator.classList.remove('bg-green-500');
              statusIndicator.classList.add('bg-red-500');
              statusIndicator.classList.add('animate-pulse'); // Ensure flashing for disconnected
          }
      }
  }

  /**
   * @dev Disconnects the user's MetaMask wallet.
   * Clears local state and updates the UI.
   */
  async function disconnectWallet() {
      if (window.ethereum && window.ethereum.isMetaMask) {
          try {
              // MetaMask does not have a direct disconnect API for programmatic use.
              // The common approach is to clear local state and prompt user to disconnect manually.
              showModal("Manual Disconnect Required", "Please disconnect your wallet manually from MetaMask if you wish to fully disconnect.");

              // Clear local state
              userAddress = null;
              signer = null;
              contract = null;
              updateConnectionStatus(); // Update UI to disconnected state
              console.log("Wallet state cleared locally.");
          } catch (error) {
              console.error("Error during manual disconnect prompt:", error);
          }
      } else {
          showModal("MetaMask Not Detected", "MetaMask is not detected. Cannot disconnect.");
      }
  }

  /**
   * @dev Connects the user's MetaMask wallet to the application.
   * Initializes the ethers provider, signer, and contract instance.
   * Sets global `contract`, `signer`, `userAddress` variables.
   * Displays the connected wallet address.
   */
  async function connectWallet() {
      console.log("Attempting to connect wallet...");
      if (!window.ethereum) {
          throw new Error("MetaMask not found. Please install it to connect your wallet.");
      }

      // Check if CONTRACT_ADDRESS is still the placeholder
      if (CONTRACT_ADDRESS === "0xYourDeployedContractAddressHere" || CONTRACT_ADDRESS === "0x2059cFd51BA8557e835a8Aa3d3B332E8B89b1eC0") {
          throw new Error("CRITICAL ERROR: Please update the 'CONTRACT_ADDRESS' variable in script.js with your deployed smart contract address. All blockchain interactions will fail until this is corrected.");
      }

      try {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          await provider.send("eth_requestAccounts", []);
          signer = provider.getSigner();
          userAddress = await signer.getAddress();
          console.log("Wallet connected. User Address:", userAddress);

          // Update connection status after successful connection
          updateConnectionStatus();

          console.log("Fetching contract ABI...");
          const abiRes = await fetch('/static/abi/ClinicalTrialManager.json');
          const abi = await abiRes.json();
          console.log("ABI fetched successfully.");

          contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
          console.log("Contract initialized:", contract.address);

          if (window.location.pathname === '/') {
              checkUserRole();
          }

      } catch (error) {
          console.error("Error connecting wallet or initializing contract:", error);
          let errorMessage = "Failed to connect wallet or load contract. See console for details.";
          if (error.code === 4001) {
              errorMessage = "Wallet connection rejected by the user.";
          } else if (error.message.includes("network does not support ENS")) {
              errorMessage = "Connected to an unsupported network. Please switch to Sepolia or another supported testnet.";
          } else if (error.message.includes("could not detect network")) {
               errorMessage = "Could not detect Ethereum network. Ensure MetaMask is connected and on a valid network.";
          } else if (error.code === 'INVALID_ARGUMENT' && error.message.includes("contract address")) {
              errorMessage = "Invalid contract address configured. Please check CONTRACT_ADDRESS in script.js.";
          }
          throw new Error(errorMessage); // Re-throw to be caught by DOMContentLoaded listener
      }
  }

  /**
   * @dev Helper function to get transaction options including buffered gas limit and gas price.
   * @param {ethers.BigNumber} estimatedGas The estimated gas for the transaction.
   * @returns {object} An object containing gasLimit and gasPrice.
   */
  async function getTxOptions(estimatedGas) {
      if (!signer || !signer.provider) {
          console.error("Signer or provider not available for gas estimation.");
          // Fallback with a robust gasLimit buffer (30% buffer)
          return {
              gasLimit: estimatedGas.mul(130).div(100)
          };
      }

      try {
          const feeData = await signer.provider.getFeeData();
          const bufferedGasLimit = estimatedGas.mul(130).div(100);
          let txOptions = { gasLimit: bufferedGasLimit };

          if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
              const minPriorityFee = ethers.utils.parseUnits("1", "gwei");

              txOptions.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas.gt(minPriorityFee)
                  ? feeData.maxPriorityFeePerGas
                  : minPriorityFee;

              txOptions.maxFeePerGas = feeData.maxFeePerGas;

              console.log("Using EIP-1559 (aligned with MetaMask 'Low') transaction options:", txOptions);
          } else if (feeData.gasPrice) {
              txOptions.gasPrice = feeData.gasPrice;
              console.log("Using legacy gasPrice (low) transaction option:", txOptions);
          } else {
              console.warn("Could not retrieve full fee data for gas pricing. Proceeding with gasLimit only.");
          }

          return txOptions;
      } catch (error) {
          console.error("Error fetching gas data or calculating gas options:", error);
          return {
              gasLimit: estimatedGas.mul(130).div(100)
          };
      }
  }

  /**
   * @dev Sends an email notification to a specified recipient.
   * This function interacts with a backend API endpoint '/api/send_email'.
   * @param {string} subject - The subject of the email.
   * @param {string} message - The body/content of the email.
   * @param {string} recipient - The email address of the recipient.
   */
  async function sendEmailNotification(subject, message, recipient) {
      try {
          const response = await fetch('/api/send_email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subject, message, recipient })
          });
          const result = await response.json();
          if (result.status !== 'success') {
              console.warn('Email send failed:', result.message);
          } else {
              console.log('Email sent successfully:', result.message);
          }
      } catch (err) {
          console.error('Failed to send email:', err);
      }
  }


  /**
   * @dev Checks the connected user's role based on the smart contract's `roles` mapping
   * and redirects or displays appropriate options. This is primarily for the index page.
   */
  async function checkUserRole() {
      if (!contract || !userAddress) {
          console.error("Contract or user address not available to check role for redirection.");
          return;
      }

      try {

          const role = await contract.getRole(userAddress);
          const roleValue = role.toNumber?.() || parseInt(role.toString());
          console.log("User role (enum value):", role.toString());

          let sponsorAddress = "";
          try {
              sponsorAddress = await contract.getSponsor();
              console.log("Sponsor address from contract:", sponsorAddress);
          } catch (sponsorError) {
              console.warn("Could not retrieve sponsor address from contract (this might be expected if not yet deployed or ABI mismatch):", sponsorError);
          }

          if (roleValue === 3 || userAddress.toLowerCase() === sponsorAddress.toLowerCase()) {
              window.location.href = "/sponsor";
          } else if (roleValue === 1) {
              window.location.href = "/doctor";
          } else if (roleValue === 2) {
              window.location.href = "/patient";
          } else {
              const userPanel = document.getElementById("userPanel");
              if (userPanel) {
                  userPanel.innerHTML = `
                      <p class="text-lg mb-4">Are you a doctor or a patient? Register below:</p>
                      <button id="showDoctorFormBtn" class="p-2 mr-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition duration-200">Register as Doctor</button>
                      <button id="showPatientFormBtn" class="p-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition duration-200">Register as Patient</button>
                  `;
                  document.getElementById('showDoctorFormBtn').addEventListener('click', showDoctorForm);
                  document.getElementById('showPatientFormBtn').addEventListener('click', showPatientForm);
              }
          }
      } catch (error) {
          console.error("Detailed error checking user role:", error);
          let errorMessage = "An unexpected error occurred while checking your role. See console for details.";
          if (error.code === 'CALL_EXCEPTION' || error.code === -32603) {
              errorMessage = "Blockchain call failed. This might be due to an incorrect contract address, network mismatch, or an ABI mismatch (e.g., 'roles' or 'getSponsor' function not found).";
          } else if (error.message.includes("invalid address")) {
              errorMessage = "Invalid contract address detected. Please ensure 'CONTRACT_ADDRESS' is correct.";
          }
          showModal("Role Check Error", errorMessage);
      }
  }

  /**
   * @dev Displays the doctor registration form.
   */
  function showDoctorForm() {
      const userPanel = document.getElementById("userPanel");
      if (userPanel) {
          userPanel.innerHTML = `
              <h3 class="text-xl font-semibold mb-4">Doctor Registration</h3>
              <input id="docName" placeholder="Name" type="text" class="w-full mb-3 text-gray-900"><br>
              <input id="docLicense" placeholder="Medical License ID" type="text" class="w-full mb-4 text-gray-900"><br>
              <button id="registerDoctorBtn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition duration-200">Register Doctor</button>
          `;
          document.getElementById('registerDoctorBtn').addEventListener('click', registerDoctor);
      }
  }

  /**
   * @dev Handles the doctor registration process.
   * Validates license ID and sends the transaction to the smart contract.
   */
  async function registerDoctor() {
      if (!contract || !signer) {
          showModal("Wallet Not Connected", "Please connect your wallet first.");
          return;
      }

      const name = document.getElementById("docName").value;
      const license = document.getElementById("docLicense").value;

      if (!name || !license) {
          showModal("Input Required", "Please fill in both name and medical license ID.");
          return;
      }

      try {
          const verificationResponse = await fetch('/api/verify_doctor_license', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({ licenseId: license, name: name })
          });

          const verificationResult = await verificationResponse.json();

          if (!verificationResult.verified) {
              showModal("Verification Failed", verificationResult.message || "License verification failed.");
              return;
          }
      } catch (error) {
          console.error("Error during license verification API call:", error);
          showModal("Verification Error", "An error occurred during license verification. Please try again later.");
          return;
      }

      try {
          const estimatedGas = await contract.estimateGas.requestDoctorRegistration(name, license);
          const txOptions = await getTxOptions(estimatedGas); // Use the helper

          const tx = await contract.requestDoctorRegistration(name, license, txOptions); // Apply txOptions
          await tx.wait();
          showModal("Success", "Doctor registration request submitted. Waiting for sponsor approval.");
          // Send email notification to sponsor
          await sendEmailNotification(
              "New Doctor Registration Request",
              `A new doctor (${name}, License ID: ${license}) with address ${userAddress} has requested registration. Please approve them on the Sponsor Dashboard.`,
              "sponsor@example.com" // Placeholder for sponsor email
          );
          checkUserRole();
      } catch (error) {
          console.error("Error registering doctor on blockchain:", error);
          let specificErrorMessage = "Failed to submit doctor registration. Please check MetaMask for more details on the transaction failure (e.g., 'revert' reason or gas limit).";

          if (error.code === 4001) {
              specificErrorMessage = "Transaction rejected by user in MetaMask.";
          } else if (error.message.includes("insufficient funds")) {
              specificErrorMessage = "Insufficient funds in your wallet to cover gas fees.";
          } else if (error.message.includes("gas required exceeds allowance")) {
              specificErrorMessage = "Gas limit might be too low. Try increasing it in MetaMask.";
          } else if (error.reason) {
              specificErrorMessage = `Transaction failed: ${error.reason}`;
          } else if (error.data && error.data.message) {
              specificErrorMessage = `Transaction failed: ${error.data.message}`;
          } else if (error.message) {
              specificErrorMessage = `Transaction failed: ${error.message}`;
          }

          showModal("Registration Failed", specificErrorMessage);
      }
  }

  /**
   * @dev Displays the patient registration form (for self-registration on index.html).
   */
  function showPatientForm() {
      const userPanel = document.getElementById("userPanel");
      if (userPanel) {
          userPanel.innerHTML = `
              <h3 class="text-xl font-semibold mb-4">Patient Registration</h3>
              <input id="patName" placeholder="Name" type="text" class="w-full mb-4 text-gray-900"><br>
              <button id="registerPatientBtn" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition duration-200">Register Patient</button>
          `;
          document.getElementById('registerPatientBtn').addEventListener('click', registerPatient);
      }
  }

  /**
   * @dev Handles the patient self-registration process (from index.html).
   * Sends the transaction to the smart contract.
   */
  async function registerPatient() {
      if (!contract || !signer) {
          showModal("Wallet Not Connected", "Please connect your wallet first.");
          return;
      }

      const name = document.getElementById("patName").value;

      if (!name) {
          showModal("Input Required", "Please enter your name.");
          return;
      }

      try {
          const estimatedGas = await contract.estimateGas.registerPatient(name);
          const txOptions = await getTxOptions(estimatedGas); // Use the helper

          const tx = await contract.registerPatient(name, txOptions); // Apply txOptions
          await tx.wait();
          showModal("Success", "Patient registered successfully! Redirecting to Patient Dashboard.");
          // Send email notification to sponsor
          await sendEmailNotification(
              "New Patient Registration",
              `A new patient (${name}) with address ${userAddress} has self-registered.`,
              "sponsor@example.com" // Placeholder for sponsor email
          );
          // Send email notification to patient (assuming their email can be derived or is hardcoded for now)
          await sendEmailNotification(
              "Welcome to Clinical Trials System",
              `Dear ${name},\n\nWelcome to the Decentralized Clinical Trials System! Your registration is complete. You can now join available clinical trials.\n\nBest regards,\nYour Trial Team`,
              "patient@example.com" // Placeholder for patient email
          );
          window.location.href = "/patient";
      } catch (error) {
          console.error("Error registering patient:", error);
          showModal("Registration Failed", "Failed to register patient. See console for details. Ensure you are not already registered.");
      }
  }

  /**
   * @dev Handles the registration of a new patient from the modal by a doctor.
   */
  async function registerNewPatientByDoctorFromModal() {
      if (!contract || !signer) {
          showModal("Wallet Not Connected", "Please connect your wallet as a Doctor.");
          return;
      }

      const patientName = document.getElementById('newPatientName').value;
      const patientAddress = document.getElementById('newPatientAddress').value;

      if (!patientName || !patientAddress) {
          showModal("Input Required", "Please enter both patient's name and wallet address.");
          return;
      }
      if (!ethers.utils.isAddress(patientAddress)) {
          showModal("Invalid Address", "Invalid patient wallet address.");
          return;
      }

      try {
          console.log(`Attempting to register new patient from modal: ${patientName} at ${patientAddress}`);
          const estimatedGasRegister = await contract.estimateGas.registerPatientByDoctor(patientAddress, patientName);
          const txOptions = await getTxOptions(estimatedGasRegister); // Use the helper

          const txRegister = await contract.registerPatientByDoctor(patientAddress, patientName, txOptions); // Apply txOptions
          await txRegister.wait();
          showModal("Success", `New patient ${patientName} (${truncateAddress(patientAddress)}) registered successfully! You can now select them from the existing patient list.`);
          console.log(`New patient ${patientAddress} registered on blockchain from modal.`);

          // Send email notification to sponsor
          await sendEmailNotification(
              "New Patient Registered by Doctor",
              `A new patient (${patientName}, Address: ${patientAddress}) has been registered by Doctor ${userAddress}.`,
              "sponsor@example.com" // Placeholder for sponsor email
          );
          // Send email notification to the doctor who registered the patient
          await sendEmailNotification(
              "Patient Registered Successfully",
              `Dear Doctor,\n\nYou have successfully registered patient ${patientName} (Address: ${patientAddress}).`,
              "doctor@example.com" // Placeholder for doctor email
          );
          // Send email notification to patient (assuming their email can be derived or is hardcoded for now)
          await sendEmailNotification(
              "Welcome to Clinical Trials System",
              `Dear ${patientName},\n\nYou have been registered as a patient on the Decentralized Clinical Trials System by your doctor. You can now join available clinical trials.\n\nBest regards,\nYour Trial Team`,
              "patient@example.com" // Placeholder for patient email
          );

          // Refresh dropdowns to include the newly added patient
          await populateManagedTrialDropdowns(); // This populates selectExistingPatient
          await populateResultDropdowns(); // Also refresh result dropdowns

          // Optionally, select the newly added patient in the dropdown
          const selectExistingPatient = document.getElementById('selectExistingPatient');
          if (selectExistingPatient) {
              selectExistingPatient.value = patientAddress;
          }

      } catch (error) {
          console.error("Error registering new patient by doctor from modal:", error);
          let specificErrorMessage = `Failed to register new patient: ${error.reason || error.message}.`;
          if (error.code === 4001) {
              specificErrorMessage = "Transaction rejected by user in MetaMask.";
          } else if (error.message.includes("insufficient funds")) {
              specificErrorMessage = "Insufficient funds in your wallet to cover gas fees.";
          } else if (error.message.includes("gas required exceeds allowance")) {
              specificErrorMessage = "Gas limit might be too low. Try increasing it in MetaMask.";
          } else if (error.data && error.data.message) {
              specificErrorMessage += ` Details: ${error.data.message}`;
          }
          showModal("Registration Failed", specificErrorMessage + "\n\nFor more details, please check your browser's developer console (F12 -> Console tab). Ensure the patient address is not already registered and you are an approved doctor.");
      }
  }


  /**
   * @dev Allows a doctor to add an existing patient to a trial they manage.
   */
  async function doctorAddPatientToTrial() {
      if (!contract || !signer) {
          showModal("Wallet Not Connected", "Please connect your wallet as a Doctor.");
          return;
      }

      const trialId = document.getElementById('selectManagedTrialForPatient').value;
      const patientAddress = document.getElementById('selectExistingPatient').value; // Always use existing patient dropdown

      if (!trialId || !patientAddress) {
          showModal("Selection Required", "Please select a trial you manage and an existing patient.");
          return;
      }

      try {
          console.log(`Attempting to add existing patient ${patientAddress} to trial ID ${trialId}`);
          const estimatedGasAdd = await contract.estimateGas.addPatientToTrialByDoctor(trialId, patientAddress);
          const txOptions = await getTxOptions(estimatedGasAdd); // Use the helper

          const txAdd = await contract.addPatientToTrialByDoctor(trialId, patientAddress, txOptions); // Apply txOptions
          await txAdd.wait();
          showModal("Success", `Patient ${truncateAddress(patientAddress)} added to Trial ID ${trialId} successfully!`);
          console.log(`Patient ${patientAddress} added to trial ${trialId} on blockchain.`);

          // Clear fields and refresh data
          document.getElementById('selectManagedTrialForPatient').value = '';
          document.getElementById('selectExistingPatient').value = ''; // Clear selection
          loadManagedTrialsAndPatients(); // Refresh the combined table
          populateResultDropdowns(); // Refresh dropdowns for results
      } catch (error) {
          console.error("Error adding patient to trial by doctor:", error);
          let specificErrorMessage = "Failed to add patient to trial. Ensure you are the trial manager, the patient is registered, and not already in this trial.";
          if (error.code === 4001) {
              specificErrorMessage = "Transaction rejected by user in MetaMask.";
          } else if (error.message.includes("insufficient funds")) {
              specificErrorMessage = "Insufficient funds in your wallet to cover gas fees.";
          } else if (error.message.includes("gas required exceeds allowance")) {
              specificErrorMessage = "Gas limit might be too low. Try increasing it in MetaMask.";
          } else if (error.reason) {
              specificErrorMessage = `Operation failed: ${error.reason}`;
          } else if (error.data && error.data.message) {
              specificErrorMessage = `Operation failed: ${error.data.message}`;
          } else if (error.message) {
              specificErrorMessage = `Operation failed: ${error.message}`;
          }
          showModal("Operation Failed", specificErrorMessage);
      }
  }

  /**
   * @dev Populates the dropdowns for selecting managed trials and existing patients.
   * Filters for active trials.
   */
  async function populateManagedTrialDropdowns() {
      if (!contract) { console.warn("Contract not loaded, cannot populate managed trial dropdowns."); return; }
      const managedTrialSelect = document.getElementById('selectManagedTrialForPatient');
      const existingPatientSelect = document.getElementById('selectExistingPatient');

      if (!managedTrialSelect || !existingPatientSelect) return; // Exit if elements don't exist on page

      managedTrialSelect.innerHTML = '<option value="">Select a Trial You Manage</option>';
      existingPatientSelect.innerHTML = '<option value="">Select a Registered Patient</option>';

      try {
          const totalTrials = await contract.trialCounter();
          for (let i = 1; i <= totalTrials.toNumber(); i++) {
              try {
                  const trialDetails = await contract.getTrial(i);
                  if (trialDetails.exists) { // ONLY show active trials
                      const option = document.createElement('option');
                      option.value = i.toString();
                      option.textContent = `ID ${i.toString()}: ${trialDetails.title}`;
                      managedTrialSelect.appendChild(option);
                  }
              } catch (innerError) {
                  console.warn(`Could not load details for Trial ID ${i} for managed trial dropdown:`, innerError);
              }
          }
          if (managedTrialSelect.options.length === 1) { // Only the default "Select a Trial" option
              managedTrialSelect.innerHTML = '<option value="">No active trials found.</option>';
          }

          const registeredPatientAddrs = await contract.getAllRegisteredPatientAddresses();
          for (const patientAddr of registeredPatientAddrs) {
              const patDetails = await contract.getPatientDetails(patientAddr);
              const option = document.createElement('option');
              option.value = patientAddr;
              option.textContent = `${patDetails.name} (${truncateAddress(patientAddr)})`;
              option.title = patientAddr;
              existingPatientSelect.appendChild(option);
          }
      } catch (error) {
          console.error("Error populating managed trial dropdowns:", error);
          // Display error in UI if elements are present
          if (managedTrialSelect) managedTrialSelect.innerHTML = '<option value="">Error loading trials. Check contract.</option>';
          if (existingPatientSelect) existingPatientSelect.innerHTML = '<option value="">Error loading patients. Check contract.</option>';
      }
  }

  /**
   * @dev Populates the dropdowns for selecting patients and trials in the Submit Result section.
   * Filters for active trials.
   */
  async function populateResultDropdowns() {
      if (!contract) { console.warn("Contract not loaded, cannot populate result dropdowns."); return; }
      const resultPatientSelect = document.getElementById('resultPatientSelect');
      const resultTrialSelect = document.getElementById('resultTrialSelect');

      if (!resultPatientSelect || !resultTrialSelect) return; // Exit if elements don't exist on page

      resultPatientSelect.innerHTML = '<option value="">Select Patient</option>';
      resultTrialSelect.innerHTML = '<option value="">Select Trial</option>';

      try {
          const registeredPatientAddrs = await contract.getAllRegisteredPatientAddresses();
          for (const patientAddr of registeredPatientAddrs) {
              const patDetails = await contract.getPatientDetails(patientAddr);
              const option = document.createElement('option');
              option.value = patientAddr;
              option.textContent = `${patDetails.name} (${truncateAddress(patientAddr)})`;
              option.title = patientAddr;
              resultPatientSelect.appendChild(option);
          }

          const managedTrialIds = await contract.getTrialsByDoctor(); // This already filters for active trials
          for (const trialId of managedTrialIds) {
              const trialDetails = await contract.getTrial(trialId); // getTrial no longer requires exists=true
              const option = document.createElement('option');
              option.value = trialId.toString();
              option.textContent = `ID ${trialId.toString()}: ${trialDetails.title}`;
              resultTrialSelect.appendChild(option);
          }
      }
      catch (error) {
          console.error("Error populating result dropdowns:", error);
          if (resultPatientSelect) resultPatientSelect.innerHTML = '<option value="">Error loading patients. Check contract.</option>';
          if (resultTrialSelect) resultTrialSelect.innerHTML = '<option value="">Error loading trials. Check contract.</option>';
      }
  }


  // --- Sponsor Specific Functions ---

  /**
   * @dev Creates a new clinical trial.
   * Accessible by sponsor or approved doctor.
   */
  async function createTrial() {
      if (!contract || !signer) {
          showModal("Wallet Not Connected", "Please connect your wallet.");
          return;
      }
      const title = document.getElementById('newTrialTitle').value;
      const phase = document.getElementById('newTrialPhase').value;
      const condition = document.getElementById('newTrialCondition').value;
      const location = document.getElementById('newTrialLocation').value;

      if (!title || !phase || !condition || !location) {
          showModal("Input Required", "Please fill in all trial details (title, phase, condition, location).");
          return;
      }

      try {
          // When estimating gas, you pass the contract arguments
          const estimatedGas = await contract.estimateGas.createTrial(title, phase, condition, location);
          const txOptions = await getTxOptions(estimatedGas); // Use the helper

          const tx = await contract.createTrial(title, phase, condition, location, txOptions);
          await tx.wait();

          showModal("Success", "Trial created successfully!");
          document.getElementById('newTrialTitle').value = '';
          document.getElementById('newTrialPhase').value = '';
          document.getElementById('newTrialCondition').value = '';
          document.getElementById('newTrialLocation').value = '';

          const trialCounter = await contract.trialCounter();
          const newTrialAddressElem = document.getElementById('newTrialAddress');
          if (newTrialAddressElem) {
              newTrialAddressElem.textContent = `New Trial Created! ID: ${trialCounter.toString()}`;
          }
          // Send email notification to sponsor
          await sendEmailNotification(
              "New Clinical Trial Created",
              `A new clinical trial titled "${title}" (ID: ${trialCounter.toString()}) has been created by sponsor.`,
              "sponsor@example.com" // Replace with actual sponsor email
          );

          loadAllTrialsForSponsor();
          populateTrialManagementDropdowns(); // Refresh dropdowns
          populateAssignDoctorDropdowns(); // Refresh dropdowns
      } catch (error) {
          console.error("Error creating trial:", error);
          let specificErrorMessage = "Failed to create trial. Please check MetaMask for more details on the transaction failure (e.g., 'revert' reason or gas limit).";
          if (error.code === 4001) {
              specificErrorMessage = "Transaction rejected by user in MetaMask.";
          } else if (error.message.includes("insufficient funds")) {
              specificErrorMessage = "Insufficient funds in your wallet to cover gas fees.";
          } else if (error.message.includes("gas required exceeds allowance")) {
              specificErrorMessage = "Gas limit might be too low. Try increasing it in MetaMask.";
          } else if (error.reason) {
              specificErrorMessage = `Transaction failed: ${error.reason}`;
          } else if (error.data && error.data.message) {
              specificErrorMessage = `Transaction failed: ${error.data.message}`;
          } else if (error.message) {
              specificErrorMessage = `Transaction failed: ${error.message}`;
          }
          showModal("Trial Creation Failed", specificErrorMessage);
      }
  }

  /**
   * @dev Shows the delete confirmation modal.
   */
  function showDeleteConfirmation() {
      const selectedTrialId = document.getElementById('selectTrialToManage').value;
      if (!selectedTrialId) {
          showModal("Selection Required", "Please select a trial to deactivate.");
          return;
      }
      trialIdToDelete = selectedTrialId;
      document.getElementById('confirmationModal').style.display = 'flex';
  }

  /**
   * @dev Hides the delete confirmation modal.
   */
  function hideDeleteConfirmation() {
      document.getElementById('confirmationModal').style.display = 'none';
      trialIdToDelete = null;
  }

  /**
   * @dev Deletes a trial. Only callable by the sponsor.
   */
  async function deleteTrial() {
      if (!contract || !signer) {
          showModal("Wallet Not Connected", "Please connect your wallet as Sponsor.");
          hideDeleteConfirmation();
          return;
      }

      const trialId = trialIdToDelete;
      if (!trialId) {
          showModal("No Trial Selected", "No trial selected for deactivation.");
          hideDeleteConfirmation();
          return;
      }

      try {
          const estimatedGas = await contract.estimateGas.deleteTrial(trialId);
          const txOptions = await getTxOptions(estimatedGas); // Use the helper

          const tx = await contract.deleteTrial(trialId, txOptions); // Apply txOptions
          await tx.wait();
          showModal("Success", `Trial ID ${trialId} deactivated successfully!`);
          // Send email notification to sponsor
          await sendEmailNotification(
              "Clinical Trial Deactivated",
              `Clinical trial ID ${trialId} has been deactivated by sponsor.`,
              "sponsor@example.com" // Replace with actual sponsor email
          );
          hideDeleteConfirmation();
          loadAllTrialsForSponsor(); // Refresh the main trials table (will now exclude this trial)
          loadDeletedTrialsForSponsor(); // Refresh the new deleted trials table
          populateTrialManagementDropdowns(); // Refresh dropdowns
          populateAssignDoctorDropdowns(); // Refresh dropdowns
      } catch (error) {
          console.error("Error deleting trial:", error);
          let specificErrorMessage = "Failed to deactivate trial. Ensure you are the sponsor and the trial exists.";
          if (error.code === 4001) {
              specificErrorMessage = "Transaction rejected by user in MetaMask.";
          } else if (error.message.includes("insufficient funds")) {
              specificErrorMessage = "Insufficient funds in your wallet to cover gas fees.";
          } else if (error.message.includes("gas required exceeds allowance")) {
              specificErrorMessage = "Gas limit might be too low. Try increasing it in MetaMask.";
          } else if (error.reason) {
              specificErrorMessage = `Deactivation failed: ${error.reason}`;
          } else if (error.data && error.data.message) {
              specificErrorMessage = `Deactivation failed: ${error.data.message}`;
          } else if (error.message) {
              specificErrorMessage = `Deactivation failed: ${error.message}`;
          }
          showModal("Deactivation Failed", specificErrorMessage);
          hideDeleteConfirmation();
      }
  }

  /**
   * @dev Restores a previously deleted trial. Only callable by the sponsor.
   * @param {number} trialId The ID of the trial to restore.
   */
  async function restoreTrial(trialId) {
      if (!contract || !signer) {
          showModal("Wallet Not Connected", "Please connect your wallet as Sponsor.");
          return;
      }

      try {
          const estimatedGas = await contract.estimateGas.restoreTrial(trialId);
          const txOptions = await getTxOptions(estimatedGas); // Use the helper

          const tx = await contract.restoreTrial(trialId, txOptions); // Apply txOptions
          await tx.wait();
          showModal("Success", `Trial ID ${trialId} restored successfully!`);
          // Send email notification to sponsor
          await sendEmailNotification(
              "Clinical Trial Restored",
              `Clinical trial ID ${trialId} has been restored by sponsor.`,
              "sponsor@example.com" // Replace with actual sponsor email
          );
          loadAllTrialsForSponsor(); // Refresh active trials table
          loadDeletedTrialsForSponsor(); // Refresh deleted trials table (will now exclude this trial)
          populateTrialManagementDropdowns(); // Refresh dropdowns
          populateAssignDoctorDropdowns(); // Refresh dropdowns
      } catch (error) {
          console.error("Error restoring trial:", error);
          let specificErrorMessage = "Failed to restore trial. Ensure you are the sponsor and the trial is currently deleted.";
          if (error.code === 4001) {
              specificErrorMessage = "Transaction rejected by user in MetaMask.";
          } else if (error.message.includes("insufficient funds")) {
              specificErrorMessage = "Insufficient funds in your wallet to cover gas fees.";
          } else if (error.message.includes("gas required exceeds allowance")) {
              specificErrorMessage = "Gas limit might be too low. Try increasing it in MetaMask.";
          } else if (error.reason) {
              specificErrorMessage = `Restoration failed: ${error.reason}`;
          } else if (error.data && error.data.message) {
              specificErrorMessage = `Restoration failed: ${error.data.message}`;
          } else if (error.message) {
              specificErrorMessage = `Restoration failed: ${error.message}`;
          }
          showModal("Restoration Failed", specificErrorMessage);
      }
  }


  /**
   * @dev Populates the dropdown for selecting trials to manage (edit/delete).
   * Filters for active trials.
   */
  async function populateTrialManagementDropdowns() {
      if (!contract) { console.warn("Contract not loaded, cannot populate trial management dropdowns."); return; }
      const selectTrialToManage = document.getElementById('selectTrialToManage');
      // Check if the element exists, as this function might be called from doctor/patient pages too
      if (!selectTrialToManage) return;

      selectTrialToManage.innerHTML = '<option value="">Select a Trial</option>'; // Clear existing options

      try {
          const totalTrials = await contract.trialCounter();
          for (let i = 1; i <= totalTrials.toNumber(); i++) {
              try {
                  const trialDetails = await contract.getTrial(i);
                  if (trialDetails.exists) { // Only show active trials
                      const option = document.createElement('option');
                      option.value = i.toString();
                      option.textContent = `ID ${i.toString()}: ${trialDetails.title}`;
                      selectTrialToManage.appendChild(option);
                  }
              } catch (innerError) {
                  console.warn(`Could not load details for Trial ID ${i} for management dropdown:`, innerError);
              }
          }
          if (selectTrialToManage.options.length === 1) { // Only the default "Select a Trial" option
              selectTrialToManage.innerHTML = '<option value="">No active trials found.</option>';
          }
      } catch (error) {
          console.error("Error populating trial management dropdown:", error);
          selectTrialToManage.innerHTML = '<option value="">Error loading trials. Check contract deployment.</option>';
      }
  }


  /**
   * @dev Populates the dropdowns for assigning doctors to trials.
   * Filters for active trials.
   */
  async function populateAssignDoctorDropdowns() {
      if (!contract) { console.warn("Contract not loaded, cannot populate assign doctor dropdowns."); return; }
      const assignTrialSelect = document.getElementById('assignTrialSelect');
      const assignDoctorSelect = document.getElementById('assignDoctorSelect');

      // Check if elements exist
      if (!assignTrialSelect || !assignDoctorSelect) return;

      assignTrialSelect.innerHTML = '<option value="">Select a Trial</option>';
      assignDoctorSelect.innerHTML = '<option value="">Select an Approved Doctor</option>';

      try {
          const totalTrials = await contract.trialCounter();
          for (let i = 1; i <= totalTrials.toNumber(); i++) {
              try {
                  const trialDetails = await contract.getTrial(i);
                  if (trialDetails.exists) { // Only show active trials
                      const option = document.createElement('option');
                      option.value = i.toString();
                      option.textContent = `ID ${i.toString()}: ${trialDetails.title}`;
                      assignTrialSelect.appendChild(option);
                  }
              } catch (innerError) {
                  console.warn(`Could not load details for Trial ID ${i} for assign dropdown:`, innerError);
              }
          }
          if (assignTrialSelect.options.length === 1) {
              assignTrialSelect.innerHTML = '<option value="">No active trials found.</option>';
          }

          const registeredDoctorAddrs = await contract.getAllRegisteredDoctorAddresses();
          for (const doctorAddr of registeredDoctorAddrs) {
              const docDetails = await contract.getDoctorDetails(doctorAddr);
              if (docDetails.approved) { // Only show approved doctors
                  const option = document.createElement('option');
                  option.value = doctorAddr;
                  option.textContent = `${docDetails.name} (${truncateAddress(doctorAddr)})`;
                  option.title = doctorAddr;
                  assignDoctorSelect.appendChild(option);
              }
          }
          if (assignDoctorSelect.options.length === 1) {
              assignDoctorSelect.innerHTML = '<option value="">No approved doctors found.</option>';
          }
      } catch (error) {
          console.error("Error populating assign doctor dropdowns:", error);
          if (assignTrialSelect) assignTrialSelect.innerHTML = '<option value="">Error loading trials. Check contract.</option>';
          if (assignDoctorSelect) assignDoctorSelect.innerHTML = '<option value="">Error loading doctors. Check contract.</option>';
      }
  }


  /**
   * @dev Assigns an approved doctor as the manager of a specific trial.
   * Accessible by sponsor.
   */
  async function assignDoctorToTrial() {
      if (!contract || !signer) {
          showModal("Wallet Not Connected", "Please connect your wallet as Sponsor.");
          return;
      }

      const trialId = document.getElementById('assignTrialSelect').value; // Use dropdown value
      const doctorAddress = document.getElementById('assignDoctorSelect').value; // Use dropdown value

      if (!trialId || !doctorAddress) {
          showModal("Selection Required", "Please select both a Trial ID and a Doctor.");
          return;
      }

      try {
          const estimatedGas = await contract.estimateGas.assignTrialManager(trialId, doctorAddress);
          const txOptions = await getTxOptions(estimatedGas); // Use the helper

          const tx = await contract.assignTrialManager(trialId, doctorAddress, txOptions); // Apply txOptions
          await tx.wait();
          showModal("Success", `Doctor ${truncateAddress(doctorAddress)} assigned to Trial ID ${trialId} successfully!`);
          // Send email notification to the doctor
          await sendEmailNotification(
              "New Trial Assignment",
              `You have been assigned as the manager for Clinical Trial ID ${trialId}.`,
              "doctor@example.com" // Placeholder for doctor email
          );

          document.getElementById('assignTrialSelect').value = ''; // Clear selection
          document.getElementById('assignDoctorSelect').value = ''; // Clear selection
          loadAllTrialsForSponsor(); // Refresh the main trials table
      } catch (error) {
          console.error("Error assigning doctor to trial:", error);
          let specificErrorMessage = "Failed to assign doctor to trial. Ensure you are the sponsor, the trial ID is valid, and the doctor is approved.";
          if (error.code === 4001) {
              specificErrorMessage = "Transaction rejected by user in MetaMask.";
          } else if (error.message.includes("insufficient funds")) {
              specificErrorMessage = "Insufficient funds in your wallet to cover gas fees.";
          } else if (error.message.includes("gas required exceeds allowance")) {
              specificErrorMessage = "Gas limit might be too low. Try increasing it in MetaMask.";
          } else if (error.reason) {
              specificErrorMessage = `Assignment failed: ${error.reason}`;
          } else if (error.data && error.data.message) {
              specificErrorMessage = `Assignment failed: ${error.data.message}`;
          } else if (error.message) {
              specificErrorMessage = `Assignment failed: ${error.message}`;
          }
          showModal("Assignment Failed", specificErrorMessage);
      }
  }


  /**
   * @dev Loads and displays all ACTIVE trials for the sponsor.
   * It iterates from 1 to trialCounter to fetch each trial's details.
   */
  async function loadAllTrialsForSponsor() {
      if (!contract) {
          console.warn("Contract not loaded when attempting to load all trials. Retrying after delay...");
          const tableBody = document.getElementById('allTrialsTableBody');
          if (tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500 py-4">Contract not loaded. Please ensure MetaMask is connected and refresh.</td></tr>';
          return;
      }
      const tableBody = document.getElementById('allTrialsTableBody');
      if (!tableBody) return;

      tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">Loading active trials...</td></tr>';

      try {
          const totalTrials = await contract.trialCounter();
          if (totalTrials.eq(0)) {
              tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">No trials created yet.</td></tr>';
              lastSyncTimes.allTrials = Date.now();
              updateLastSyncDisplay('lastSyncAllTrials', lastSyncTimes.allTrials);
              checkSyncStatusAndFlash();
              return;
          }

          let trialsFound = false;
          tableBody.innerHTML = ''; // Clear loading message
          for (let i = 1; i <= totalTrials.toNumber(); i++) {
              try {
                  const trialDetails = await contract.getTrial(i);
                  if (trialDetails.exists) { // ONLY display active trials
                      const row = tableBody.insertRow();
                      row.innerHTML = `
                          <td class="py-2 px-4 border-b">${i}</td>
                          <td class="py-2 px-4 border-b">${trialDetails.title}</td>
                          <td class="py-2 px-4 border-b" title="${trialDetails.manager}">${truncateAddress(trialDetails.manager)}</td>
                          <td class="py-2 px-4 border-b">${trialDetails.patientCount.toString()}</td>
                          <td class="py-2 px-4 border-b"><span class="text-green-600 font-semibold">Active</span></td>
                      `;
                      trialsFound = true;
                  }
              } catch (innerError) {
                  console.warn(`Could not load details for Trial ID ${i}:`, innerError);
                  // This specific trial ID might not exist or have an error, skip it.
              }
          }
          if (!trialsFound) {
              tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">No active trials to display.</td></tr>';
          }
          lastSyncTimes.allTrials = Date.now();
          updateLastSyncDisplay('lastSyncAllTrials', lastSyncTimes.allTrials);
          checkSyncStatusAndFlash();
      } catch (error) {
          console.error("Error loading all trials for sponsor:", error);
          tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500 py-4">Error loading all trials. Please ensure your contract is deployed and CONTRACT_ADDRESS is correct.</td></tr>';
      }
  }

  /**
   * @dev Loads and displays DELETED trials for the sponsor.
   */
  async function loadDeletedTrialsForSponsor() {
      if (!contract) {
          console.warn("Contract not loaded when attempting to load deleted trials.");
          const tableBody = document.getElementById('deletedTrialsTableBody');
          if (tableBody) tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-red-500 py-4">Contract not loaded. Please ensure MetaMask is connected and refresh.</td></tr>';
          return;
      }
      const tableBody = document.getElementById('deletedTrialsTableBody');
      if (!tableBody) return;

      tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">Loading deleted trials...</td></tr>';

      try {
          const deletedTrialIds = await contract.getAllDeletedTrialIds(); // New contract function

          if (deletedTrialIds.length === 0) {
              tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">No deleted trials.</td></tr>';
              lastSyncTimes.deletedTrials = Date.now();
              updateLastSyncDisplay('lastSyncDeletedTrials', lastSyncTimes.deletedTrials);
              checkSyncStatusAndFlash();
              return;
          }

          tableBody.innerHTML = ''; // Clear loading message
          for (let i = 0; i < deletedTrialIds.length; i++) {
              const trialId = deletedTrialIds[i];
              try {
                  const trialDetails = await contract.getTrial(trialId); // getTrial can now return details for deleted trials
                  if (!trialDetails.exists) { // Double-check it's actually deleted
                      const row = tableBody.insertRow();
                      row.innerHTML = `
                          <td class="py-2 px-4 border-b">${trialId.toString()}</td>
                          <td class="py-2 px-4 border-b">${trialDetails.title}</td>
                          <td class="py-2 px-4 border-b" title="${trialDetails.manager}">${truncateAddress(trialDetails.manager)}</td>
                          <td class="py-2 px-4 border-b">
                              <button onclick="restoreTrial(${trialId})" class="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md transition duration-200">Restore</button>
                          </td>
                      `;
                  }
              } catch (innerError) {
                  console.warn(`Could not load details for deleted Trial ID ${trialId}:`, innerError);
              }
          }
          if (tableBody.innerHTML === '') {
              tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">No deleted trials.</td></tr>';
          }
          lastSyncTimes.deletedTrials = Date.now();
          updateLastSyncDisplay('lastSyncDeletedTrials', lastSyncTimes.deletedTrials);
          checkSyncStatusAndFlash();
      } catch (error) {
          console.error("Error loading deleted trials for sponsor:", error);
          tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-red-500 py-4">Error loading deleted trials. Ensure your contract is deployed and CONTRACT_ADDRESS is correct.</td></tr>';
      }
  }


  /**
   * @dev Loads and displays pending doctor registration requests for the sponsor.
   */
  async function loadPendingDoctorRequests() {
      if (!contract) { console.warn("Contract not loaded, cannot load pending doctor requests."); return; }
      const tableBody = document.getElementById('pendingDoctorsTableBody');
      if (!tableBody) return;

      tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">Loading...</td></tr>';

      try {
          const pendingDoctorAddrs = await contract.getAllPendingDoctorAddresses();
          console.log("Fetched pendingDoctorAddrs:", pendingDoctorAddrs);

          if (pendingDoctorAddrs.length === 0) {
              tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">No pending requests.</td></tr>';
              lastSyncTimes.pendingDoctors = Date.now();
              updateLastSyncDisplay('lastSyncPendingDoctors', lastSyncTimes.pendingDoctors);
              checkSyncStatusAndFlash();
              return;
          }

          tableBody.innerHTML = '';
          let requestsFound = false;
          for (const addr of pendingDoctorAddrs) {
              const docDetails = await contract.getDoctorDetails(addr);
              console.log(`Doctor ${addr} details:`, docDetails);

              if (!docDetails.approved) {
                  const row = tableBody.insertRow();
                  row.innerHTML = `
                      <td class="py-2 px-4 border-b" title="${addr}">${truncateAddress(addr)}</td>
                      <td class="py-2 px-4 border-b">${docDetails.name}</td>
                      <td class="py-2 px-4 border-b">${docDetails.licenseId}</td>
                      <td class="py-2 px-4 border-b"><button onclick="approveDoctor('${addr}')" class="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md transition duration-200">Approve</button></td>
                  `;
                  requestsFound = true;
              }
          }
          if (!requestsFound) {
               tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">No pending requests.</td></tr>';
          }
          lastSyncTimes.pendingDoctors = Date.now();
          updateLastSyncDisplay('lastSyncPendingDoctors', lastSyncTimes.pendingDoctors);
          checkSyncStatusAndFlash();
      } catch (error) {
          console.error("Error loading pending doctor requests:", error);
          tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-red-500 py-4">Error loading requests. Check contract deployment or data.</td>';
      }
  }

  /**
   * @dev Approves a doctor's registration.
   * Called by the "Approve" button on the Sponsor Dashboard.
   * @param {string} doctorAddress The address of the doctor to approve.
   */
  async function approveDoctor(doctorAddress) {
      if (!contract || !signer) {
          showModal("Wallet Not Connected", "Please connect your wallet as Sponsor.");
          return;
      }

      try {
          const doctorDetails = await contract.getDoctorDetails(doctorAddress); // Get doctor's name for email
          const estimatedGas = await contract.estimateGas.approveDoctor(doctorAddress);
          const txOptions = await getTxOptions(estimatedGas); // Use the helper

          const tx = await contract.approveDoctor(doctorAddress, txOptions); // Apply txOptions
          await tx.wait();
          showModal("Success", `Doctor ${truncateAddress(doctorAddress)} approved successfully!`);
          // Send email notification to the doctor
          await sendEmailNotification(
              "Doctor Registration Approved",
              `Dear ${doctorDetails.name},\n\nYour registration as a doctor on the Decentralized Clinical Trials System has been approved. You can now log in and manage clinical trials.\n\nBest regards,\nSponsor Team`,
              "doctor@example.com" // Replace with actual doctor email if available
          );

          loadPendingDoctorRequests();
          loadRegisteredDoctors();
          populateAssignDoctorDropdowns();
      } catch (error) {
          console.error("Error approving doctor:", error);
          let specificErrorMessage = "Failed to approve doctor. Please check MetaMask for details.";
          if (error.code === 4001) {
              specificErrorMessage = "Transaction rejected by user in MetaMask.";
          } else if (error.message.includes("insufficient funds")) {
              specificErrorMessage = "Insufficient funds in your wallet to cover gas fees.";
          } else if (error.message.includes("gas required exceeds allowance")) {
              specificErrorMessage = "Gas limit might be too low. Try increasing it in MetaMask.";
          } else if (error.reason) {
              specificErrorMessage = `Approval failed: ${error.reason}`;
          } else if (error.data && error.data.message) {
              specificErrorMessage = `Approval failed: ${error.data.message}`;
          } else if (error.message) {
              specificErrorMessage = `Approval failed: ${error.message}`;
          }
          showModal("Approval Failed", specificErrorMessage);
      }
  }


  /**
   * @dev Loads and displays all registered doctors.
   * Accessible by sponsor.
   */
  async function loadRegisteredDoctors() {
      if (!contract) { console.warn("Contract not loaded, cannot load registered doctors."); return; }
      const tableBody = document.getElementById('registeredDoctorsTableBody');
      if (!tableBody) return;

      tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">Loading...</td></tr>';

      try {
          const doctorAddrs = await contract.getAllRegisteredDoctorAddresses();

          if (doctorAddrs.length === 0) {
              tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">No registered doctors.</td></tr>';
              lastSyncTimes.registeredDoctors = Date.now();
              updateLastSyncDisplay('lastSyncRegisteredDoctors', lastSyncTimes.registeredDoctors);
              checkSyncStatusAndFlash();
              return;
          }

          tableBody.innerHTML = '';
          for (const addr of doctorAddrs) {
              const docDetails = await contract.getDoctorDetails(addr);
              const row = tableBody.insertRow();
              row.innerHTML = `
                  <td class="py-2 px-4 border-b" title="${addr}">${truncateAddress(addr)}</td>
                  <td class="py-2 px-4 border-b">${docDetails.name}</td>
                  <td class="py-2 px-4 border-b">${docDetails.licenseId}</td>
                  <td class="py-2 px-4 border-b">${docDetails.approved ? '<span class="text-green-600 font-semibold">Yes</span>' : '<span class="text-yellow-600 font-semibold">No</span>'}</td>
              `;
          }
          lastSyncTimes.registeredDoctors = Date.now();
          updateLastSyncDisplay('lastSyncRegisteredDoctors', lastSyncTimes.registeredDoctors);
          checkSyncStatusAndFlash();
      } catch (error) {
          console.error("Error loading registered doctors:", error);
          tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-red-500 py-4">Error loading doctors. Check contract deployment or data.</td></tr>';
      }
  }

  /**
   * @dev Loads and displays all registered patients.
   * Accessible by sponsor.
   */
  async function loadRegisteredPatients() {
      if (!contract) { console.warn("Contract not loaded, cannot load registered patients."); return; }
      const tableBody = document.getElementById('registeredPatientsTableBody');
      if (!tableBody) return;

      tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">Loading...</td></tr>';

      try {
          const patientAddrs = await contract.getAllRegisteredPatientAddresses();

          if (patientAddrs.length === 0) {
              tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">No registered patients.</td></tr>';
              lastSyncTimes.registeredPatients = Date.now();
              updateLastSyncDisplay('lastSyncRegisteredPatients', lastSyncTimes.registeredPatients);
              checkSyncStatusAndFlash();
              return;
          }

          tableBody.innerHTML = '';
          for (const addr of patientAddrs) {
              const patDetails = await contract.getPatientDetails(addr);
              const row = tableBody.insertRow();
              row.innerHTML = `
                  <td class="py-2 px-4 border-b" title="${addr}">${truncateAddress(addr)}</td>
                  <td class="py-2 px-4 border-b">${patDetails.name}</td>
                  <td class="py-2 px-4 border-b">${patDetails.trialsJoined.length.toString()}</td>
                  <td class="py-2 px-4 border-b">${patDetails.dataHash ? truncateAddress(patDetails.dataHash) : 'N/A'}</td> `;
          }
          lastSyncTimes.registeredPatients = Date.now();
          updateLastSyncDisplay('lastSyncRegisteredPatients', lastSyncTimes.registeredPatients);
          checkSyncStatusAndFlash();
      } catch (error) {
          console.error("Error loading registered patients:", error);
          tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-red-500 py-4">Error loading patients. Check contract deployment or data.</td></tr>';
      }
  }


  /**
   * @dev Loads and displays trials managed by the current doctor, and the patients within those trials.
   * Filters for active trials.
   */
  async function loadManagedTrialsAndPatients() {
      if (!contract || !userAddress) { console.warn("Contract not loaded, cannot load doctor's managed trials and patients."); return; }
      const tableBody = document.getElementById('myManagedTrialsAndPatientsTableBody');
      if (!tableBody) return;

      tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">Loading your managed trials and patients...</td></tr>';

      try {
          const managedTrialIds = await contract.getTrialsByDoctor(); // This already filters for active trials
          console.log("Managed Trial IDs for doctor:", managedTrialIds);

          if (managedTrialIds.length === 0) {
              tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">No active trials managed by you.</td></tr>';
              lastSyncTimes.myManagedTrialsAndPatients = Date.now(); // Update sync time for this section
              updateLastSyncDisplay('lastSyncManagedTrialsPatients', lastSyncTimes.myManagedTrialsAndPatients);
              checkSyncStatusAndFlash();
              return;
          }

          tableBody.innerHTML = '';
          let trialsWithPatientsFound = false;
          for (const trialId of managedTrialIds) {
              const trialDetails = await contract.getTrial(trialId); // getTrial no longer requires exists=true
              // Double check exists here as a safeguard, though getTrialsByDoctor should filter
              if (!trialDetails.exists) continue;

              const patientsInTrial = await contract.getPatientsInTrial(trialId);

              if (patientsInTrial.length === 0) {
                  const row = tableBody.insertRow();
                  row.innerHTML = `
                      <td class="py-2 px-4 border-b">${trialId.toString()}</td>
                      <td class="py-2 px-4 border-b">${trialDetails.title}</td>
                      <td class="py-2 px-4 border-b" title="${trialDetails.manager}">${truncateAddress(trialDetails.manager)}</td>
                      <td colspan="2" class="text-center text-gray-500 py-2 px-4 border-b">No patients in this trial yet.</td>
                  `;
                  trialsWithPatientsFound = true; // Mark as found even if no patients, as trial is active
              } else {
                  for (const patientAddr of patientsInTrial) {
                      const patDetails = await contract.getPatientDetails(patientAddr);
                      const row = tableBody.insertRow();
                      row.innerHTML = `
                          <td class="py-2 px-4 border-b">${trialId.toString()}</td>
                          <td class="py-2 px-4 border-b">${trialDetails.title}</td>
                          <td class="py-2 px-4 border-b" title="${trialDetails.manager}">${truncateAddress(trialDetails.manager)}</td>
                          <td class="py-2 px-4 border-b" title="${patientAddr}">${truncateAddress(patientAddr)}</td>
                          <td class="py-2 px-4 border-b">${patDetails.name}</td>
                      `;
                      trialsWithPatientsFound = true;
                  }
              }
          }
          if (!trialsWithPatientsFound && managedTrialIds.length > 0) {
              tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">You manage trials, but no patients are assigned to them yet.</td></tr>';
          } else if (!trialsWithPatientsFound && managedTrialIds.length === 0) {
               tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">No active trials managed by you.</td></tr>';
          }
          lastSyncTimes.myManagedTrialsAndPatients = Date.now(); // Update sync time for this section
          updateLastSyncDisplay('lastSyncManagedTrialsPatients', lastSyncTimes.myManagedTrialsAndPatients);
          checkSyncStatusAndFlash();
      } catch (error) {
          console.error("Error loading doctor's managed trials and patients:", error);
          tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500 py-4">Error loading data. Check contract deployment or if you are an approved doctor.</td></tr>';
      }
  }


  /**
   * @dev Submits a result for a patient in a specific trial.
   * Accessible only by the approved doctor managing the trial.
   */
  async function submitPatientResult() {
      if (!contract || !signer) { showModal("Wallet Not Connected", "Please connect your wallet."); return; }
      const patientAddress = document.getElementById('resultPatientSelect').value;
      const trialId = document.getElementById('resultTrialSelect').value;
      const data = document.getElementById('resultData').value;

      if (!patientAddress || !trialId || !data) {
          showModal("Input Required", "Please select a patient and a trial, and enter result data.");
          return;
      }

      try {
          const estimatedGas = await contract.estimateGas.submitResult(patientAddress, trialId, data);
          const txOptions = await getTxOptions(estimatedGas); // Use the helper

          const tx = await contract.submitResult(patientAddress, trialId, data, txOptions); // Apply txOptions
          await tx.wait();
          showModal("Success", "Patient result submitted successfully!");

          // Fetch patient and trial details for email notifications
          const patientDetails = await contract.getPatientDetails(patientAddress);
          const trialDetails = await contract.getTrial(trialId);
          const doctorDetails = await contract.getDoctorDetails(trialDetails.manager); // Assuming trial.manager is the doctor's address

          // Send email notification to patient
          await sendEmailNotification(
              "New Clinical Trial Result Published",
              `Dear ${patientDetails.name},\n\nA new result has been published for your participation in trial "${trialDetails.title}" (ID: ${trialId}).\nResult: ${data}\n\nBest regards,\nYour Trial Team`,
              "patient@example.com" // Placeholder for patient email
          );
          // Send email notification to doctor
          await sendEmailNotification(
              "New Result Submitted for Your Trial",
              `Dear ${doctorDetails.name},\n\nA new result has been submitted for patient ${patientDetails.name} (Address: ${patientAddress}) in trial "${trialDetails.title}" (ID: ${trialId}).\nResult: ${data}\n\nBest regards,\nSponsor Team`,
              "doctor@example.com" // Placeholder for doctor email
          );
          // Send email notification to sponsor
          await sendEmailNotification(
              "New Clinical Trial Result Recorded",
              `A new result has been recorded for patient ${patientDetails.name} (Address: ${patientAddress}) in trial "${trialDetails.title}" (ID: ${trialId}).\nResult: ${data}\nSubmitted by Doctor: ${userAddress}\n\nReview on Sponsor Dashboard.`,
              "sponsor@example.com" // Placeholder for sponsor email
          );


          document.getElementById('resultPatientSelect').value = '';
          document.getElementById('resultTrialSelect').value = '';
          document.getElementById('resultData').value = '';
          // Refresh patient dashboard to show new results if patient is viewing
          // loadMyJoinedTrials(); // This is a patient function, but might be called if doctor is also a patient
      } catch (error) {
          console.error("Error submitting result:", error);
          let specificErrorMessage = "Failed to submit result. Ensure you are the managing doctor for this trial and patient is valid.";
          if (error.code === 4001) {
              specificErrorMessage = "Transaction rejected by user in MetaMask.";
          } else if (error.message.includes("insufficient funds")) {
              specificErrorMessage = "Insufficient funds in your wallet to cover gas fees.";
          } else if (error.message.includes("gas required exceeds allowance")) {
              specificErrorMessage = "Gas limit might be too low. Try increasing it in MetaMask.";
          } else if (error.reason) {
              specificErrorMessage = `Transaction failed: ${error.reason}`;
          } else if (error.data && error.data.message) {
              specificErrorMessage = `Transaction failed: ${error.data.message}`;
          } else if (error.message) {
              specificErrorMessage = `Transaction failed: ${error.message}`;
          }
          showModal("Submission Failed", specificErrorMessage);
      }
  }

  /**
   * @dev Loads and displays trials the current patient has joined, along with their results.
   * Filters for active trials.
   */
  async function loadMyJoinedTrials() {
      if (!contract || !userAddress) { console.warn("Contract not loaded, cannot load patient's joined trials."); return; }
      const tableBody = document.getElementById('myJoinedTrialsTableBody');
      if (!tableBody) return;

      tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">Loading...</td></tr>';

      try {
          const joinedTrialIds = await contract.getMyTrials(); // This already filters for active trials
          if (joinedTrialIds.length === 0) {
              tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">No active trials joined yet.</td></tr>';
              lastSyncTimes.myJoinedTrials = Date.now(); // Update sync time for this section
              updateLastSyncDisplay('lastSyncMyJoinedTrials', lastSyncTimes.myJoinedTrials);
              checkSyncStatusAndFlash();
              return;
          }

          tableBody.innerHTML = '';
          let trialsFound = false;
          for (const trialId of joinedTrialIds) {
              try {
                  const trialDetails = await contract.getTrial(trialId); // getTrial no longer requires exists=true
                  // Double check exists here as a safeguard, though getMyTrials should filter
                  if (!trialDetails.exists) continue;

                  let resultData = "Results are not published yet.";

                  try {
                      const [data, timestamp] = await contract.getResult(trialId);
                      if (data && data.length > 0) {
                          resultData = `${data} (Submitted: ${new Date(timestamp.toNumber() * 1000).toLocaleString()})`;
                      }
                  } catch (resultError) {
                      console.log(`No result found for Trial ID ${trialId} for current patient.`);
                  }

                  const row = tableBody.insertRow();
                  row.innerHTML = `
                      <td class="py-2 px-4 border-b">${trialId.toString()}</td>
                      <td class="py-2 px-4 border-b">${trialDetails.title}</td>
                      <td class="py-2 px-4 border-b" title="${trialDetails.manager}">${truncateAddress(trialDetails.manager)}</td>
                      <td class="py-2 px-4 border-b">${resultData}</td>
                  `;
                  trialsFound = true;
              } catch (innerError) {
                  console.warn(`Could not load details for Trial ID ${trialId} for patient's joined trials:`, innerError);
              }
          }
          if (!trialsFound) {
              tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">No active trials joined or trials no longer exist.</td></tr>';
          }
          lastSyncTimes.myJoinedTrials = Date.now(); // Update sync time for this section
          updateLastSyncDisplay('lastSyncMyJoinedTrials', lastSyncTimes.myJoinedTrials);
          checkSyncStatusAndFlash();
      } catch (error) {
          console.error("Error loading patient's joined trials:", error);
          tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-red-500 py-4">Error loading trials. Check contract deployment or if you are a registered patient.</td></tr>';
      }
  }

  /**
   * @dev Updates the display of the last sync time for a given element.
   * @param {string} elementId The ID of the span element to update.
   * @param {number} timestamp The timestamp of the last sync (milliseconds).
   */
  function updateLastSyncDisplay(elementId, timestamp) {
      const element = document.getElementById(elementId);
      if (element) {
          if (timestamp === 0) {
              element.textContent = "Last sync: Never";
          } else {
              const date = new Date(timestamp);
              element.textContent = `Last sync: ${date.toLocaleTimeString()} ${date.toLocaleDateString()}`;
          }
      }
  }

  /**
   * @dev Checks the sync status of each section and applies/removes flashing orange animation.
   */
  function checkSyncStatusAndFlash() {
      const now = Date.now();
      const oneMinute = 60 * 1000; // 1 minute in milliseconds

      const sections = [
          { id: 'pendingDoctors', buttonId: 'refreshPendingDoctorsBtn', syncTime: lastSyncTimes.pendingDoctors },
          { id: 'allTrials', buttonId: 'refreshAllTrialsBtn', syncTime: lastSyncTimes.allTrials },
          { id: 'deletedTrials', buttonId: 'refreshDeletedTrialsBtn', syncTime: lastSyncTimes.deletedTrials }, // New section
          { id: 'registeredDoctors', buttonId: 'refreshRegisteredDoctorsBtn', syncTime: lastSyncTimes.registeredDoctors },
          { id: 'registeredPatients', buttonId: 'refreshRegisteredPatientsBtn', syncTime: lastSyncTimes.registeredPatients },
          { id: 'myManagedTrialsAndPatients', buttonId: 'refreshManagedTrialsPatientsBtn', syncTime: lastSyncTimes.myManagedTrialsAndPatients }, // Doctor dashboard
          { id: 'myJoinedTrials', buttonId: 'refreshMyJoinedTrialsBtn', syncTime: lastSyncTimes.myJoinedTrials } // Patient dashboard
      ];

      sections.forEach(section => {
          const button = document.getElementById(section.buttonId);
          if (button) {
              // Check if more than one minute has passed since last sync AND it's not the initial state (timestamp 0)
              if (section.syncTime !== 0 && (now - section.syncTime > oneMinute)) {
                  button.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'bg-green-600', 'hover:bg-green-700', 'bg-purple-600', 'hover:bg-purple-700');
                  button.classList.add('bg-orange-500', 'hover:bg-orange-600', 'animate-pulse');
              } else {
                  // If less than a minute, or initial state, ensure correct theme color and no flashing
                  button.classList.remove('bg-orange-500', 'hover:bg-orange-600', 'animate-pulse');

                  // Apply theme-specific colors
                  if (window.location.pathname.includes('/sponsor')) {
                      button.classList.add('bg-blue-600', 'hover:bg-blue-700');
                  } else if (window.location.pathname.includes('/doctor')) {
                      button.classList.add('bg-green-600', 'hover:bg-green-700');
                  } else if (window.location.pathname.includes('/patient')) {
                      button.classList.add('bg-purple-600', 'hover:bg-purple-700');
                  } else {
                      // Fallback for other pages if needed
                      button.classList.add('bg-blue-600', 'hover:bg-blue-700');
                  }
              }
          }
      });
  }

  /**
   * @dev Performs the clinical trial search using the ClinicalTrials.gov API.
   */
  async function performClinicalTrialApiSearch() {
  const query = document.getElementById('apiOfficialNameInput')?.value.trim();
  if (!query) return;

  apiLoadingIndicator.classList.remove('hidden');
  apiResultsContainer.innerHTML = '';

  try {
    const response = await fetch(`/api/proxy_trials?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    const trials = data.studies || [];

    const formattedTrials = trials
      .filter(study => {
        const ps = study.protocolSection || {};
        const status = (ps.statusModule?.overallStatus || '').toUpperCase();
        const phases = ps.designModule?.phases || [];
        return phases.includes('PHASE3') && !['COMPLETED', 'TERMINATED'].includes(status);
      })
      .map(study => {
        const ps = study.protocolSection || {};
        return {
          title: ps.identificationModule?.briefTitle || 'N/A',
          nctId: ps.identificationModule?.nctId || 'N/A',
          status: ps.statusModule?.overallStatus || 'Unknown',
          phase: ps.designModule?.phases?.join(', ') || 'N/A',
          summary: ps.descriptionModule?.briefSummary || 'No brief summary available.'
        };
      });

    renderTrials(formattedTrials);
  } catch (err) {
    console.error('❌ API Fetch Error:', err);
    alert(`Failed to fetch clinical trials: ${err.message}`);
  } finally {
    apiLoadingIndicator.classList.add('hidden');
  }
}


function renderTrials(trials) {
  const container = document.getElementById('apiResultsContainer');
  container.innerHTML = '';

  if (!trials.length) {
    container.innerHTML = '<p class="text-center text-gray-500">No trials found.</p>';
    return;
  }

  trials.forEach(t => {
    const card = document.createElement('div');
    card.className = 'bg-gray-100 p-4 rounded-lg shadow';
    card.innerHTML = `
      <h3 class="text-lg font-bold text-green-700 mb-1">${t.title}</h3>
      <p class="text-sm"><strong>NCT ID:</strong> ${t.nctId}</p>
      <p class="text-sm"><strong>Status:</strong> ${t.status}</p>
      <p class="text-sm text-gray-700 mt-2">${t.summary}</p>
    `;
    container.appendChild(card);
  });
}



  // --- DOMContentLoaded Listener ---
  document.addEventListener('DOMContentLoaded', async () => {
      // Hide existing modals on load
      const confirmationModal = document.getElementById('confirmationModal');
      if (confirmationModal) confirmationModal.style.display = 'none';
      if (messageModal) messageModal.style.display = 'none'; // Ensure the new general message modal is hidden

      // Handle the connectWallet button if it exists on the index page
      const connectWalletBtn = document.getElementById("connectWalletBtn");
      if (connectWalletBtn) {
          connectWalletBtn.addEventListener("click", async () => {
              try {
                  await connectWallet();
              } catch (error) {
                  showModal("Wallet Connection Error", `Failed to connect wallet: ${error.message || error}`);
              }
          });
      } else {
          // This branch executes if script.js is loaded on a dashboard page (sponsor, doctor, patient)
          console.warn("Connect Wallet button not found on this page. Assuming dashboard page.");
          // Attempt to connect wallet automatically for dashboard pages
          try {
              await connectWallet();
          } catch (error) {
              console.error("Error connecting wallet or initializing contract on dashboard:", error);
              showModal("Wallet Connection Error", `Failed to connect to wallet or initialize contract. Please ensure your wallet (e.g., MetaMask) is installed, unlocked, and connected to the correct network. Error: ${error.message || error}`);
              // Disable UI elements that depend on wallet connection
              const dependentButtons = ['createTrialBtn', 'deleteTrialBtn', 'assignDoctorToTrialBtn'];
              dependentButtons.forEach(id => {
                  const btn = document.getElementById(id);
                  if (btn) btn.disabled = true;
              });
          }

          // --- Dashboard Specific Event Listeners and Initial Loads ---
          // These elements might not exist on all pages, so safely check before adding listeners
          const createTrialBtn = document.getElementById('createTrialBtn');
          if (createTrialBtn) createTrialBtn.addEventListener('click', createTrial);

          const deleteTrialBtn = document.getElementById('deleteTrialBtn');
          if (deleteTrialBtn) deleteTrialBtn.addEventListener('click', showDeleteConfirmation);

          const editTrialBtn = document.getElementById('editTrialBtn');
          if (editTrialBtn) editTrialBtn.addEventListener('click', () => showModal("Coming Soon", "Edit Trial functionality is coming soon!"));

          const confirmationModalCloseBtn = document.querySelector('#confirmationModal .close-button');
          if (confirmationModalCloseBtn) confirmationModalCloseBtn.addEventListener('click', hideDeleteConfirmation);

          const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
          if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', hideDeleteConfirmation);

          const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
          if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', deleteTrial);

          const assignDoctorToTrialBtn = document.getElementById('assignDoctorToTrialBtn');
          if (assignDoctorToTrialBtn) assignDoctorToTrialBtn.addEventListener('click', assignDoctorToTrial);

          const refreshPendingDoctorsBtn = document.getElementById('refreshPendingDoctorsBtn');
          if (refreshPendingDoctorsBtn) refreshPendingDoctorsBtn.addEventListener('click', loadPendingDoctorRequests);

          const refreshAllTrialsBtn = document.getElementById('refreshAllTrialsBtn');
          if (refreshAllTrialsBtn) refreshAllTrialsBtn.addEventListener('click', loadAllTrialsForSponsor);

          const refreshDeletedTrialsBtn = document.getElementById('refreshDeletedTrialsBtn');
          if (refreshDeletedTrialsBtn) refreshDeletedTrialsBtn.addEventListener('click', loadDeletedTrialsForSponsor);

          const refreshRegisteredDoctorsBtn = document.getElementById('refreshRegisteredDoctorsBtn');
          if (refreshRegisteredDoctorsBtn) refreshRegisteredDoctorsBtn.addEventListener('click', loadRegisteredDoctors);

          const refreshRegisteredPatientsBtn = document.getElementById('refreshRegisteredPatientsBtn');
          if (refreshRegisteredPatientsBtn) refreshRegisteredPatientsBtn.addEventListener('click', loadRegisteredPatients);

          const apiSearchButton = document.getElementById('apiSearchButton');
          if (apiSearchButton) apiSearchButton.addEventListener('click', performClinicalTrialApiSearch);

          const apiOfficialNameInput = document.getElementById('apiOfficialNameInput');
          if (apiOfficialNameInput) {
            apiOfficialNameInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    performClinicalTrialApiSearch();
                }
            });
          }

          // Initial load and sync status check for dashboard pages
          loadPendingDoctorRequests();
          loadAllTrialsForSponsor();
          loadDeletedTrialsForSponsor();
          loadRegisteredDoctors();
          loadRegisteredPatients();
          populateTrialManagementDropdowns();
          populateAssignDoctorDropdowns();
          // Doctor-specific loads (these checks prevent errors if elements don't exist on sponsor/patient pages)
          if (document.getElementById('selectManagedTrialForPatient')) populateManagedTrialDropdowns();
          if (document.getElementById('resultPatientSelect')) populateResultDropdowns();
          if (document.getElementById('myManagedTrialsAndPatientsTableBody')) loadManagedTrialsAndPatients();
          if (document.getElementById('registerNewPatientByDoctorBtn')) {
              document.getElementById('registerNewPatientByDoctorBtn').addEventListener('click', registerNewPatientByDoctorFromModal);
          }
          if (document.getElementById('addExistingPatientToTrialBtn')) {
              document.getElementById('addExistingPatientToTrialBtn').addEventListener('click', doctorAddPatientToTrial);
          }
          if (document.getElementById('submitPatientResultBtn')) {
            document.getElementById('submitPatientResultBtn').addEventListener('click', submitPatientResult);
          }


          // Patient-specific loads
          if (document.getElementById('myJoinedTrialsTableBody')) loadMyJoinedTrials();


          // Set interval to check sync status every 10 seconds
          setInterval(checkSyncStatusAndFlash, 10 * 1000);

          // Update copyright year dynamically
          const currentYear = new Date().getFullYear();
          const copyrightElement = document.getElementById('copyright-note');
          if (copyrightElement) {
              copyrightElement.textContent = `© ${currentYear} Group 4 Decentralized Clinical Trials System. All rights reserved.`;
          }
      }
  });

document.addEventListener('DOMContentLoaded', () => {
  const apiSearchButton = document.getElementById('apiSearchButton');
  const apiOfficialNameInput = document.getElementById('apiOfficialNameInput');
  const apiLoadingIndicator = document.getElementById('apiLoadingIndicator');
  const apiResultsContainer = document.getElementById('apiResultsContainer');
  const apiInitialMessage = document.getElementById('apiInitialMessage');

  apiSearchButton.addEventListener('click', async () => {
    const query = apiOfficialNameInput?.value.trim();

    if (!query) {
      showModal('Input Required', 'Please enter a drug or condition name.');
      return;
    }

    apiLoadingIndicator.classList.remove('hidden');
    apiResultsContainer.innerHTML = '';
    apiInitialMessage.classList.add('hidden');
    apiSearchButton.disabled = true;

    try {
      const response = await fetch(`/api/proxy_trials?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const studies = data.studies || [];

      if (studies.length === 0) {
        apiResultsContainer.innerHTML = '<p class="text-center text-gray-600">No Phase 3 trials found for the given query.</p>';
      } else {
        apiResultsContainer.innerHTML = studies.map(study => `
          <div class="border p-4 rounded-md shadow-sm bg-gray-50">
            <h3 class="font-bold text-lg">${study.brief_title}</h3>
            <p class="text-sm text-gray-700">NCT ID: ${study.nct_id}</p>
            <p class="text-sm text-gray-700">Status: ${study.overall_status}</p>
          </div>
        `).join('');
      }

    } catch (error) {
      console.error('❌ API Fetch Error:', error);
      showModal('API Search Error', `Failed to fetch clinical trials: ${error.message}`);
      apiResultsContainer.innerHTML = '<p class="text-center text-red-600">An error occurred. Please try again later.</p>';
      apiInitialMessage.classList.remove('hidden');
    } finally {
      apiLoadingIndicator.classList.add('hidden');
      apiSearchButton.disabled = false;
    }
  });

  function showModal(title, message) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('messageModal').style.display = 'flex';
  }

  function hideModal() {
    document.getElementById('messageModal').style.display = 'none';
  }

  window.hideModal = hideModal;
});

document.addEventListener('DOMContentLoaded', () => {
  const fetchTrialOptionsBtn = document.getElementById('fetchTrialOptionsBtn');
  const trialSearchInput = document.getElementById('trialSearchInput');
  const trialDropdown = document.getElementById('trialDropdown');
  const newTrialTitle = document.getElementById('newTrialTitle');
  const newTrialPhase = document.getElementById('newTrialPhase');
  const newTrialCondition = document.getElementById('newTrialCondition');

  fetchTrialOptionsBtn?.addEventListener('click', async () => {
    const query = trialSearchInput?.value.trim();
    if (!query) return alert("Please enter a condition to search.");

    try {
      const res = await fetch(`/api/proxy_trials?query=${encodeURIComponent(query)}`);
      const data = await res.json();

      const filtered = (data.studies || []).filter(study => {
        const ps = study.protocolSection || {};
        const status = (ps.statusModule?.overallStatus || '').toUpperCase();
        const phases = ps.designModule?.phases || [];
        return phases.includes('PHASE3') && !['COMPLETED', 'TERMINATED'].includes(status);
      });

      if (filtered.length === 0) {
        alert("No Phase 3 trials found for this condition.");
        trialDropdown.classList.add('hidden');
        return;
      }

      trialDropdown.innerHTML = '<option value="">Select a Trial</option>';
      filtered.forEach(study => {
        const ps = study.protocolSection || {};
        const title = ps.identificationModule?.briefTitle || 'Untitled';
        const id = ps.identificationModule?.nctId || '';
        const phase = (ps.designModule?.phases || []).join(', ');
        const condition = ps.conditionsModule?.conditions?.[0] || query;

        const locData = ps.contactsLocationsModule?.locations?.[0];
        let formattedLocation = 'N/A';
        if (locData) {
        const city = locData.city || '';
        const state = locData.state || '';
        const country = locData.country || '';
        formattedLocation = [city, state, country].filter(Boolean).join(', ');
        }

        const option = document.createElement('option');
        option.value = JSON.stringify({ title, phase, condition, location: formattedLocation });
        option.textContent = `${title} (${id})`;
        trialDropdown.appendChild(option);
      });

      trialDropdown.classList.remove('hidden');
    } catch (error) {
      console.error('Error fetching trials:', error);
      alert("Failed to fetch trial data.");
    }
  });

  trialDropdown?.addEventListener('change', () => {
    const selected = trialDropdown.value;
    if (!selected) return;
    const parsed = JSON.parse(selected);
    newTrialTitle.value = parsed.title || '';
    newTrialPhase.value = parsed.phase || '';
    newTrialCondition.value = parsed.condition || '';
    document.getElementById('newTrialLocation').value = parsed.location || '';
  });

});


