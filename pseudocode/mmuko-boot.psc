// ============================================================
// MMUKO-BOOT.PSC — Canonical MMUKO-OS Boot Pseudocode
// Source of truth: ../../MMUKO-OS.txt
// Purpose: mirror the exact boot phases and handoff contract
// ============================================================

ENUM MMUKO_BOOT_OUTCOME:
    PASS  = 0xAA
    HOLD  = 0xBB
    ALERT = 0xCC

ENUM MMUKO_BOOT_PHASE:
    PHASE_NEED_STATE_INIT      = 1
    PHASE_SAFETY_SCAN          = 2
    PHASE_IDENTITY_CALIBRATION = 3
    PHASE_GOVERNANCE_CHECK     = 4
    PHASE_INTERNAL_PROBE       = 5
    PHASE_INTEGRITY_VERIFICATION = 6

STRUCT MMUKO_BOOT_HANDOFF:
    magic                : CHAR[4]   = "MMKO"
    revision             : UINT16    = 0x0001
    firmware_id          : CHAR[6]   = "NSIGII"
    outcome              : MMUKO_BOOT_OUTCOME = HOLD
    completed_phases     : UINT8     = 0
    last_completed_phase : MMUKO_BOOT_PHASE = 0
    filesystem_target    : STRING    = "FAT12:mmuko-os.img"
    kernel_path          : STRING    = "/boot/mmuko.kernel"
    artifact_manifest_path : STRING  = "/boot/mmuko-artifacts.json"
    config_path          : STRING    = "/boot/mmuko-boot.cfg"
    kernel_entry_segment : UINT16    = 0x0000
    kernel_entry_offset  : UINT16    = 0x0000
    validation_flags     : UINT32    = 0
    handoff_checksum     : UINT32    = 0

FUNC complete_phase(handoff: MMUKO_BOOT_HANDOFF, phase: MMUKO_BOOT_PHASE, flag: UINT32):
    handoff.completed_phases = handoff.completed_phases + 1
    handoff.last_completed_phase = phase
    handoff.validation_flags = handoff.validation_flags OR flag

FUNC compute_handoff_checksum(handoff: MMUKO_BOOT_HANDOFF) -> UINT32:
    RETURN CRC32(handoff.magic,
                 handoff.revision,
                 handoff.firmware_id,
                 handoff.outcome,
                 handoff.completed_phases,
                 handoff.last_completed_phase,
                 handoff.filesystem_target,
                 handoff.kernel_path,
                 handoff.artifact_manifest_path,
                 handoff.config_path,
                 handoff.kernel_entry_segment,
                 handoff.kernel_entry_offset,
                 handoff.validation_flags)

FUNC mmuko_boot() -> MMUKO_BOOT_HANDOFF:
    handoff = MMUKO_BOOT_HANDOFF()

    // Phase 1 — PHASE_NEED_STATE_INIT
    REQUIRE tier1_state != NO
    complete_phase(handoff, PHASE_NEED_STATE_INIT, 0x00000001)

    // Phase 2 — PHASE_SAFETY_SCAN
    REQUIRE tier2_state != NO
    REQUIRE nsigii_minimum_safety_envelope == TRUE
    complete_phase(handoff, PHASE_SAFETY_SCAN, 0x00000002)

    // Phase 3 — PHASE_IDENTITY_CALIBRATION
    BIND operator_identity INTO handoff
    BIND temporal_frame INTO handoff
    complete_phase(handoff, PHASE_IDENTITY_CALIBRATION, 0x00000004)

    // Phase 4 — PHASE_GOVERNANCE_CHECK
    REQUIRE execution_policy == VERIFIED
    REQUIRE provenance_chain == VERIFIED
    REQUIRE filesystem_target == FAT12:mmuko-os.img
    complete_phase(handoff, PHASE_GOVERNANCE_CHECK, 0x00000008)

    // Phase 5 — PHASE_INTERNAL_PROBE
    REQUIRE nsigii_firmware_compatible == TRUE
    REQUIRE memory_map_integrity == TRUE
    REQUIRE runtime_interface_compatible == TRUE
    complete_phase(handoff, PHASE_INTERNAL_PROBE, 0x00000010)

    // Phase 6 — PHASE_INTEGRITY_VERIFICATION
    REQUIRE artifact_exists(handoff.kernel_path)
    REQUIRE artifact_exists(handoff.artifact_manifest_path)
    REQUIRE discriminant >= 0
    REQUIRE kernel_entry_is_resolved == TRUE
    complete_phase(handoff, PHASE_INTEGRITY_VERIFICATION, 0x00000020)

    handoff.outcome = PASS
    handoff.handoff_checksum = compute_handoff_checksum(handoff)
    RETURN handoff

ON FAILURE:
    handoff.outcome = ALERT
    handoff.handoff_checksum = compute_handoff_checksum(handoff)
    RETURN handoff

KERNEL ENTRY CONTRACT:
    REQUIRE handoff.magic == "MMKO"
    REQUIRE handoff.revision == 0x0001
    REQUIRE handoff.outcome == PASS
    REQUIRE handoff.completed_phases == 6
    REQUIRE VERIFY_CRC32(handoff) == TRUE
    JUMP TO (handoff.kernel_entry_segment, handoff.kernel_entry_offset)
