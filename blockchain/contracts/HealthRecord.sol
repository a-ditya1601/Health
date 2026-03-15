// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HealthRecord {
    enum AccessAction {
        RECORD_UPLOADED,
        ACCESS_REQUESTED,
        ACCESS_GRANTED,
        ACCESS_REVOKED,
        ACCESS_VIEWED,
        EMERGENCY_ACCESS_REQUESTED,
        EMERGENCY_ACCESS_GRANTED,
        EMERGENCY_ACCESS_EXPIRED
    }

    struct Patient {
        bool isRegistered;
        string metadataURI;
        uint256 registeredAt;
        address guardianWalletAddress;
    }

    struct Doctor {
        bool isRegistered;
        string metadataURI;
        uint256 registeredAt;
    }

    struct MedicalRecord {
        uint256 recordId;
        address patient;
        string ipfsHash;
        string encryptedKeyHash;
        string recordType;
        uint256 createdAt;
        bool exists;
    }

    struct AccessPermission {
        bool active;
        uint256 expiresAt;
        uint256 grantedAt;
    }

    struct EmergencyAccess {
        bool active;
        uint256 expiresAt;
        uint256 grantedAt;
        string reason;
    }

    struct AccessLog {
        uint256 logId;
        uint256 recordId;
        address patient;
        address doctor;
        AccessAction action;
        uint256 timestamp;
        uint256 expiresAt;
        string details;
    }

    address public owner;
    uint256 public nextRecordId = 1;
    uint256 public nextLogId = 1;

    mapping(address => bool) public authorizedRelayers;
    mapping(address => Patient) public patients;
    mapping(address => Doctor) public doctors;
    mapping(uint256 => MedicalRecord) public records;
    mapping(address => uint256[]) private patientRecordIds;
    mapping(address => mapping(address => AccessPermission)) private patientDoctorAccess;
    mapping(address => mapping(address => EmergencyAccess)) private patientDoctorEmergencyAccess;
    mapping(uint256 => AccessLog) public accessLogs;
    mapping(address => uint256[]) private patientLogIds;
    mapping(address => uint256[]) private doctorLogIds;
    mapping(uint256 => uint256[]) private recordLogIds;

    event RelayerUpdated(address indexed relayer, bool isAuthorized);
    event PatientRegistered(address indexed patient, string metadataURI, uint256 timestamp);
    event DoctorRegistered(address indexed doctor, string metadataURI, uint256 timestamp);
    event DoctorAccessRequested(
        address indexed patient,
        address indexed doctor,
        string reason,
        uint256 timestamp
    );
    event MedicalRecordStored(
        uint256 indexed recordId,
        address indexed patient,
        string ipfsHash,
        string encryptedKeyHash,
        string recordType,
        uint256 timestamp
    );
    event AccessGranted(
        address indexed patient,
        address indexed doctor,
        uint256 expiresAt,
        uint256 timestamp
    );
    event AccessRevoked(address indexed patient, address indexed doctor, uint256 timestamp);
    event RecordAccessed(
        uint256 indexed recordId,
        address indexed patient,
        address indexed doctor,
        uint256 timestamp
    );
    event EmergencyAccessRequested(
        address indexed patient,
        address indexed doctor,
        string reason,
        uint256 timestamp
    );
    event EmergencyAccessGranted(
        address indexed patient,
        address indexed doctor,
        uint256 expiresAt,
        string reason,
        uint256 timestamp
    );
    event EmergencyAccessExpired(
        address indexed patient,
        address indexed doctor,
        uint256 timestamp
    );
    event GuardianSet(
        address indexed patient,
        address indexed guardian,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAuthorizedRelayer() {
        require(authorizedRelayers[msg.sender], "Unauthorized relayer");
        _;
    }

    modifier onlyRegisteredPatient() {
        require(patients[msg.sender].isRegistered, "Patient not registered");
        _;
    }

    modifier onlyRegisteredDoctor() {
        require(doctors[msg.sender].isRegistered, "Doctor not registered");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedRelayers[msg.sender] = true;
        emit RelayerUpdated(msg.sender, true);
    }

    function setAuthorizedRelayer(address relayer, bool isAuthorized) external onlyOwner {
        require(relayer != address(0), "Invalid relayer");
        authorizedRelayers[relayer] = isAuthorized;
        emit RelayerUpdated(relayer, isAuthorized);
    }

    function registerPatient(string calldata metadataURI) external {
        _registerPatient(msg.sender, metadataURI);
    }

    function registerPatientByRelayer(address patient, string calldata metadataURI)
        external
        onlyAuthorizedRelayer
    {
        _registerPatient(patient, metadataURI);
    }

    function registerDoctor(string calldata metadataURI) external {
        _registerDoctor(msg.sender, metadataURI);
    }

    function registerDoctorByRelayer(address doctor, string calldata metadataURI)
        external
        onlyAuthorizedRelayer
    {
        _registerDoctor(doctor, metadataURI);
    }

    function requestDoctorAccess(address patient, string calldata reason)
        external
        onlyRegisteredDoctor
    {
        _requestDoctorAccess(patient, msg.sender, reason);
    }

    function requestDoctorAccessByRelayer(
        address doctor,
        address patient,
        string calldata reason
    ) external onlyAuthorizedRelayer {
        require(doctors[doctor].isRegistered, "Doctor not registered");
        _requestDoctorAccess(patient, doctor, reason);
    }

    function storeMedicalRecord(
        string calldata ipfsHash,
        string calldata encryptedKeyHash,
        string calldata recordType
    ) external onlyRegisteredPatient returns (uint256 recordId) {
        return _storeMedicalRecord(msg.sender, ipfsHash, encryptedKeyHash, recordType);
    }

    function storeMedicalRecordByRelayer(
        address patient,
        string calldata ipfsHash,
        string calldata encryptedKeyHash,
        string calldata recordType
    ) external onlyAuthorizedRelayer returns (uint256 recordId) {
        require(patients[patient].isRegistered, "Patient not registered");
        return _storeMedicalRecord(patient, ipfsHash, encryptedKeyHash, recordType);
    }

    function grantDoctorAccess(address doctor, uint256 durationInSeconds)
        external
        onlyRegisteredPatient
    {
        _grantDoctorAccess(msg.sender, doctor, durationInSeconds, "Standard access granted");
    }

    function grantDoctorAccessByRelayer(
        address patient,
        address doctor,
        uint256 durationInSeconds,
        string calldata reason
    ) external onlyAuthorizedRelayer {
        require(patients[patient].isRegistered, "Patient not registered");
        _grantDoctorAccess(patient, doctor, durationInSeconds, reason);
    }

    function revokeDoctorAccess(address doctor) external onlyRegisteredPatient {
        _revokeDoctorAccess(msg.sender, doctor);
    }

    function revokeDoctorAccessByRelayer(address patient, address doctor)
        external
        onlyAuthorizedRelayer
    {
        require(patients[patient].isRegistered, "Patient not registered");
        _revokeDoctorAccess(patient, doctor);
    }

    function requestEmergencyAccess(address patient, string calldata reason)
        external
        onlyRegisteredDoctor
    {
        _requestEmergencyAccess(patient, msg.sender, reason);
    }

    function requestEmergencyAccessByRelayer(
        address doctor,
        address patient,
        string calldata reason
    ) external onlyAuthorizedRelayer {
        require(doctors[doctor].isRegistered, "Doctor not registered");
        _requestEmergencyAccess(patient, doctor, reason);
    }

    function grantEmergencyAccess(
        address doctor,
        uint256 durationInSeconds,
        string calldata reason
    ) external onlyRegisteredPatient {
        _grantEmergencyAccess(msg.sender, doctor, durationInSeconds, reason);
    }

    function grantEmergencyAccessByRelayer(
        address patient,
        address doctor,
        uint256 durationInSeconds,
        string calldata reason
    ) external onlyAuthorizedRelayer {
        require(patients[patient].isRegistered, "Patient not registered");
        _grantEmergencyAccess(patient, doctor, durationInSeconds, reason);
    }

    function setGuardian(address guardian) external onlyRegisteredPatient {
        patients[msg.sender].guardianWalletAddress = guardian;
        emit GuardianSet(msg.sender, guardian, block.timestamp);
    }

    function setGuardianByRelayer(address patient, address guardian) external onlyAuthorizedRelayer {
        require(patients[patient].isRegistered, "Patient not registered");
        patients[patient].guardianWalletAddress = guardian;
        emit GuardianSet(patient, guardian, block.timestamp);
    }

    function grantEmergencyAccessByGuardian(
        address patient,
        address doctor,
        uint256 durationInSeconds,
        string calldata reason
    ) external {
        require(patients[patient].isRegistered, "Patient not registered");
        require(patients[patient].guardianWalletAddress == msg.sender, "Unauthorized: Only guardian can grant emergency access");
        _grantEmergencyAccess(patient, doctor, durationInSeconds, reason);
    }

    function grantEmergencyAccessByGuardianRelayed(
        address guardian,
        address patient,
        address doctor,
        uint256 durationInSeconds,
        string calldata reason
    ) external onlyAuthorizedRelayer {
        require(patients[patient].isRegistered, "Patient not registered");
        require(patients[patient].guardianWalletAddress == guardian, "Unauthorized: Only guardian can grant emergency access");
        _grantEmergencyAccess(patient, doctor, durationInSeconds, reason);
    }

    function markEmergencyAccessExpired(address patient) external onlyRegisteredDoctor {
        _markEmergencyAccessExpired(patient, msg.sender);
    }

    function markEmergencyAccessExpiredByRelayer(address patient, address doctor)
        external
        onlyAuthorizedRelayer
    {
        require(doctors[doctor].isRegistered, "Doctor not registered");
        _markEmergencyAccessExpired(patient, doctor);
    }

    function accessMedicalRecord(uint256 recordId)
        external
        onlyRegisteredDoctor
        returns (string memory ipfsHash, string memory encryptedKeyHash)
    {
        MedicalRecord memory record = records[recordId];
        require(record.exists, "Record does not exist");
        require(_hasValidAccess(record.patient, msg.sender), "Doctor does not have access");

        emit RecordAccessed(recordId, record.patient, msg.sender, block.timestamp);

        _createAccessLog({
            patient: record.patient,
            doctor: msg.sender,
            recordId: recordId,
            action: AccessAction.ACCESS_VIEWED,
            expiresAt: 0,
            details: record.ipfsHash
        });

        return (record.ipfsHash, record.encryptedKeyHash);
    }

    function hasDoctorAccess(address patient, address doctor) external view returns (bool) {
        return _hasValidAccess(patient, doctor);
    }

    function getPatientRecordIds(address patient) external view returns (uint256[] memory) {
        return patientRecordIds[patient];
    }

    function getPatientLogs(address patient) external view returns (uint256[] memory) {
        return patientLogIds[patient];
    }

    function getDoctorLogs(address doctor) external view returns (uint256[] memory) {
        return doctorLogIds[doctor];
    }

    function getRecordLogs(uint256 recordId) external view returns (uint256[] memory) {
        return recordLogIds[recordId];
    }

    function getDoctorAccessDetails(address patient, address doctor)
        external
        view
        returns (
            bool standardAccessActive,
            uint256 standardAccessExpiresAt,
            bool emergencyAccessActive,
            uint256 emergencyAccessExpiresAt,
            string memory emergencyReason
        )
    {
        AccessPermission memory permission = patientDoctorAccess[patient][doctor];
        EmergencyAccess memory emergencyAccess = patientDoctorEmergencyAccess[patient][doctor];

        standardAccessActive = permission.active && permission.expiresAt >= block.timestamp;
        standardAccessExpiresAt = permission.expiresAt;
        emergencyAccessActive = emergencyAccess.active && emergencyAccess.expiresAt >= block.timestamp;
        emergencyAccessExpiresAt = emergencyAccess.expiresAt;
        emergencyReason = emergencyAccess.reason;
    }

    function _registerPatient(address patient, string calldata metadataURI) internal {
        require(patient != address(0), "Invalid patient");
        require(!patients[patient].isRegistered, "Patient already registered");

        patients[patient] = Patient({
            isRegistered: true,
            metadataURI: metadataURI,
            registeredAt: block.timestamp,
            guardianWalletAddress: address(0)
        });

        emit PatientRegistered(patient, metadataURI, block.timestamp);
    }

    function _registerDoctor(address doctor, string calldata metadataURI) internal {
        require(doctor != address(0), "Invalid doctor");
        require(!doctors[doctor].isRegistered, "Doctor already registered");

        doctors[doctor] = Doctor({
            isRegistered: true,
            metadataURI: metadataURI,
            registeredAt: block.timestamp
        });

        emit DoctorRegistered(doctor, metadataURI, block.timestamp);
    }

    function _requestDoctorAccess(
        address patient,
        address doctor,
        string calldata reason
    ) internal {
        require(patients[patient].isRegistered, "Patient not registered");
        require(bytes(reason).length > 0, "Reason required");

        emit DoctorAccessRequested(patient, doctor, reason, block.timestamp);

        _createAccessLog({
            patient: patient,
            doctor: doctor,
            recordId: 0,
            action: AccessAction.ACCESS_REQUESTED,
            expiresAt: 0,
            details: reason
        });
    }

    function _storeMedicalRecord(
        address patient,
        string calldata ipfsHash,
        string calldata encryptedKeyHash,
        string calldata recordType
    ) internal returns (uint256 recordId) {
        require(bytes(ipfsHash).length > 0, "IPFS hash required");

        recordId = nextRecordId++;

        records[recordId] = MedicalRecord({
            recordId: recordId,
            patient: patient,
            ipfsHash: ipfsHash,
            encryptedKeyHash: encryptedKeyHash,
            recordType: recordType,
            createdAt: block.timestamp,
            exists: true
        });

        patientRecordIds[patient].push(recordId);

        emit MedicalRecordStored(
            recordId,
            patient,
            ipfsHash,
            encryptedKeyHash,
            recordType,
            block.timestamp
        );

        _createAccessLog({
            patient: patient,
            doctor: address(0),
            recordId: recordId,
            action: AccessAction.RECORD_UPLOADED,
            expiresAt: 0,
            details: ipfsHash
        });
    }

    function _grantDoctorAccess(
        address patient,
        address doctor,
        uint256 durationInSeconds,
        string memory reason
    ) internal {
        require(doctors[doctor].isRegistered, "Doctor not registered");
        require(durationInSeconds > 0, "Duration must be greater than zero");

        uint256 expiresAt = block.timestamp + durationInSeconds;

        patientDoctorAccess[patient][doctor] = AccessPermission({
            active: true,
            expiresAt: expiresAt,
            grantedAt: block.timestamp
        });

        emit AccessGranted(patient, doctor, expiresAt, block.timestamp);

        _createAccessLog({
            patient: patient,
            doctor: doctor,
            recordId: 0,
            action: AccessAction.ACCESS_GRANTED,
            expiresAt: expiresAt,
            details: reason
        });
    }

    function _revokeDoctorAccess(address patient, address doctor) internal {
        AccessPermission storage permission = patientDoctorAccess[patient][doctor];
        require(permission.active, "No active access found");

        permission.active = false;
        permission.expiresAt = block.timestamp;

        EmergencyAccess storage emergencyAccess = patientDoctorEmergencyAccess[patient][doctor];
        if (emergencyAccess.active) {
            emergencyAccess.active = false;
            emergencyAccess.expiresAt = block.timestamp;
        }

        emit AccessRevoked(patient, doctor, block.timestamp);

        _createAccessLog({
            patient: patient,
            doctor: doctor,
            recordId: 0,
            action: AccessAction.ACCESS_REVOKED,
            expiresAt: block.timestamp,
            details: "Access revoked by patient"
        });
    }

    function _requestEmergencyAccess(
        address patient,
        address doctor,
        string calldata reason
    ) internal {
        require(patients[patient].isRegistered, "Patient not registered");
        require(bytes(reason).length > 0, "Reason required");

        emit EmergencyAccessRequested(patient, doctor, reason, block.timestamp);

        _createAccessLog({
            patient: patient,
            doctor: doctor,
            recordId: 0,
            action: AccessAction.EMERGENCY_ACCESS_REQUESTED,
            expiresAt: 0,
            details: reason
        });
    }

    function _grantEmergencyAccess(
        address patient,
        address doctor,
        uint256 durationInSeconds,
        string calldata reason
    ) internal {
        require(doctors[doctor].isRegistered, "Doctor not registered");
        require(durationInSeconds > 0, "Duration must be greater than zero");
        require(bytes(reason).length > 0, "Reason required");

        uint256 expiresAt = block.timestamp + durationInSeconds;

        patientDoctorEmergencyAccess[patient][doctor] = EmergencyAccess({
            active: true,
            expiresAt: expiresAt,
            grantedAt: block.timestamp,
            reason: reason
        });

        emit EmergencyAccessGranted(patient, doctor, expiresAt, reason, block.timestamp);

        _createAccessLog({
            patient: patient,
            doctor: doctor,
            recordId: 0,
            action: AccessAction.EMERGENCY_ACCESS_GRANTED,
            expiresAt: expiresAt,
            details: reason
        });
    }

    function _markEmergencyAccessExpired(address patient, address doctor) internal {
        EmergencyAccess storage emergencyAccess = patientDoctorEmergencyAccess[patient][doctor];
        require(emergencyAccess.active, "No active emergency access");
        require(block.timestamp > emergencyAccess.expiresAt, "Emergency access still active");

        emergencyAccess.active = false;

        emit EmergencyAccessExpired(patient, doctor, block.timestamp);

        _createAccessLog({
            patient: patient,
            doctor: doctor,
            recordId: 0,
            action: AccessAction.EMERGENCY_ACCESS_EXPIRED,
            expiresAt: block.timestamp,
            details: emergencyAccess.reason
        });
    }

    function _hasValidAccess(address patient, address doctor) internal view returns (bool) {
        AccessPermission memory permission = patientDoctorAccess[patient][doctor];
        if (permission.active && permission.expiresAt >= block.timestamp) {
            return true;
        }

        EmergencyAccess memory emergencyAccess = patientDoctorEmergencyAccess[patient][doctor];
        if (emergencyAccess.active && emergencyAccess.expiresAt >= block.timestamp) {
            return true;
        }

        return false;
    }

    function _createAccessLog(
        address patient,
        address doctor,
        uint256 recordId,
        AccessAction action,
        uint256 expiresAt,
        string memory details
    ) internal {
        uint256 logId = nextLogId++;

        accessLogs[logId] = AccessLog({
            logId: logId,
            recordId: recordId,
            patient: patient,
            doctor: doctor,
            action: action,
            timestamp: block.timestamp,
            expiresAt: expiresAt,
            details: details
        });

        if (patient != address(0)) {
            patientLogIds[patient].push(logId);
        }

        if (doctor != address(0)) {
            doctorLogIds[doctor].push(logId);
        }

        if (recordId != 0) {
            recordLogIds[recordId].push(logId);
        }
    }
}
