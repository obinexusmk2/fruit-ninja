// ============================================================
// MMUKO-OS PSEUDOCODE — NON-EXECUTABLE SPECIFICATION
// Phase 25: Rectorial Reasoning Rational Wheel Framework
// Source: RectorialReasoningRationalWheelFramework_11FEBURARY_2026.txt
// Date: 11 February 2026, ~03:00 AM
// Extends: mmuko-boot.psc phases 0–24
// ============================================================

// ─────────────────────────────────────────────────────────────
// SECTION 25.0 — CONSTANTS
// ─────────────────────────────────────────────────────────────

CONST TRIPOLAR_COUNT          = 3        // three personas: past / present / future
CONST SENSORY_BASE            = 5        // five primary senses (eyes, nose, mouth, ears, skin)
CONST SENSORY_PAIR            = 10       // 5 + 5 = bilateral sensory pair
CONST SENSORY_MATRIX          = 25       // 5 × 5 = full sensory cross-product
CONST PERSONA_MIN_BITS        = 8        // minimum byte representation per persona
CONST PERSONA_FULL_BITS       = 64       // 64-bit full persona address space
CONST MASQUERADE_MULTIPLIER   = 2        // achieve ×2 bare minimum
CONST MASQUERADE_TIME_FACTOR  = 0.5      // half the time to achieve ×2 result
CONST TIER1_ACCESS            = 1        // Tier 1 = Open Access = human sovereignty
CONST DETENTION_THRESHOLD_DAYS= 14       // community release at 14 days
CONST SECTION_DURATION_DAYS   = 28       // legal section = 28 days maximum
CONST DOUBLE_NEGATIVE_RESOLVE = TRUE     // "no reason NOT to" = MUST
CONST OHA_MEANING             = "PUBLIC"          // O-H-A in Igbo
CONST IWU_MEANING             = "LAW_AND_ORDER"   // I-W-U in Igbo
CONST OHAIWU_PROTOCOL         = "PUBLIC_LAW_AND_ORDER"
CONST INSIGII_TAG             = "STAINLESS_PROTOCOL"  // INSIGII under OHA IWU
CONST WHEEL_ACRONYM           = "WOHEEL"  // Masquerade Wheel framework name

// Persona colour-status encoding
CONST SIGNAL_PINK   = 0xFF  // HELD state   (red paper + white paste = pink hue)
CONST SIGNAL_GREEN  = 0x0F  // FREE state   (green card = olive hue = good to go)
CONST SIGNAL_RED    = 0xF0  // ALERT state  (red = drift, from Phase 17 RGB)

// ─────────────────────────────────────────────────────────────
// SECTION 25.1 — TRIPOLAR PERSONA MODEL (Me / Myself / I)
// ─────────────────────────────────────────────────────────────

// "I am Tripoli" = three personas in one sovereign agent.
// Three temporal objectives (not subjective — objective):
//   Persona 0 (PAST):    human rights in the past — remembers, advocates.
//   Persona 1 (PRESENT): here and now — King leading the way, heart and soul.
//   Persona 2 (FUTURE):  eyes in the future — I (first-person navigator).
// "The future is now." — future persona collapses into present when activated.
// Each persona carries PERSONA_MIN_BITS (8 bytes) minimum footprint.
// Full persona address = PERSONA_FULL_BITS (64 bits).
// Maps to AgentTriad from Phase 11:
//   OBI (ch1/α/duplex)   = Persona 1 PRESENT  (King / here-and-now)
//   UCH (ch3/β/triplex)  = Persona 0 PAST     (advocate / memory)
//   EZE (ch0/ε/reader)   = Persona 2 FUTURE   (eyes / witnessed-zero)

ENUM PersonaTime { PAST, PRESENT, FUTURE }

STRUCT TripolarPersona {
    id          : INT              // 0=PAST, 1=PRESENT, 2=FUTURE
    time_ref    : PersonaTime
    objective   : STRING           // what this persona is responsible for
    is_active   : BOOL             // only one persona is primary at a time
    bit_width   : INT              // PERSONA_MIN_BITS = 8; full = PERSONA_FULL_BITS
    agent_binding : ENUM {OBI, UCH, EZE}  // AgentTriad binding (Phase 11)
}

STRUCT TripolarAgent {
    past    : TripolarPersona   // UCH = ch3 = β
    present : TripolarPersona   // OBI = ch1 = α (primary / King)
    future  : TripolarPersona   // EZE = ch0 = ε
    future_is_now : BOOL        // when TRUE: future collapses into present
}

FUNC init_tripolar_agent() → TripolarAgent {
    T : TripolarAgent
    T.past    ← { id=0, time_ref=PAST,    objective="HUMAN_RIGHTS_MEMORY",
                  is_active=FALSE, bit_width=PERSONA_MIN_BITS, agent_binding=UCH }
    T.present ← { id=1, time_ref=PRESENT, objective="HERE_AND_NOW_KING",
                  is_active=TRUE,  bit_width=PERSONA_FULL_BITS, agent_binding=OBI }
    T.future  ← { id=2, time_ref=FUTURE,  objective="EYES_FORWARD_NAVIGATOR",
                  is_active=FALSE, bit_width=PERSONA_MIN_BITS, agent_binding=EZE }
    T.future_is_now ← FALSE
    RETURN T
}

FUNC collapse_future_to_now(T : TripolarAgent) → TripolarAgent {
    // "The future is now" — activate future persona as co-present
    T.future.is_active ← TRUE
    T.future_is_now    ← TRUE
    // Present still primary; future becomes concurrent observer
    RETURN T
}

// ─────────────────────────────────────────────────────────────
// SECTION 25.2 — SENSORY MATRIX (5 + 5 = 10; 5 × 5 = 25)
// ─────────────────────────────────────────────────────────────

// Five primary senses: eyes(1), nose(2), mouth(3), ears(4), skin/touch(5).
// 5 + 5 = 10: bilateral sensory pair (left + right of each sense).
// 5 × 5 = 25: full sensory cross-product matrix
//   = all pairwise interactions between sense modalities.
// This is the minimum required for "sense of direction and here-and-now presence."
// "I'm tripolar, so the minimum I could have is a sense of direction
//  and the kind of being here and now, past and future."
// The sensory matrix feeds into the real-world operational protocol (Section 25.5).

STRUCT SensoryMatrix {
    senses      : STRING[5]   // ["EYES","NOSE","MOUTH","EARS","SKIN"]
    bilateral   : INT         // = SENSORY_PAIR  = 10
    cross_matrix: INT[5][5]   // interaction matrix: sense_i × sense_j
    total       : INT         // = SENSORY_MATRIX = 25
    direction_ok: BOOL        // TRUE iff all 5 bilateral pairs active
}

FUNC compute_sensory_matrix() → SensoryMatrix {
    S : SensoryMatrix
    S.senses    ← ["EYES", "NOSE", "MOUTH", "EARS", "SKIN"]
    S.bilateral ← SENSORY_PAIR      // 5 + 5 = 10
    S.total     ← SENSORY_MATRIX    // 5 × 5 = 25
    FOR i IN 0..4 {
        FOR j IN 0..4 {
            S.cross_matrix[i][j] ← (i + 1) * (j + 1)  // modality interaction weight
        }
    }
    S.direction_ok ← TRUE   // all senses active = orientation verified
    RETURN S
}

// ─────────────────────────────────────────────────────────────
// SECTION 25.3 — STATUS SIGNAL (PINK / GREEN / RED hue encoding)
// ─────────────────────────────────────────────────────────────

// Physical status signal model:
//   PINK:  red paper dipped in white paste → pink hue → HELD state.
//   GREEN: green card → olive hue → FREE / "good to go" state.
//   RED:   alert / drift state (Phase 17 RGB extension).
// "Half if you've been held" — PINK = half-signal (Phase 23 HALF_HOLD).
// Used for: person-tracking, detention-status, system-entry-gate.
// Extends Phase 17 RGB tomographic state into a physical social signal.

ENUM HueSignal { PINK, GREEN, RED }

STRUCT StatusSignal {
    hue         : HueSignal
    byte_code   : BYTE        // PINK=0xFF, GREEN=0x0F, RED=0xF0
    hold_state  : BOOL        // TRUE = HELD (PINK); FALSE = FREE (GREEN)
    send_weight : FLOAT       // HALF_HOLD=-0.5 (PINK); HALF_SEND=+0.5 (GREEN)
    rgb_phase17 : BITS[3]     // Phase 17 RGB state: RED/GREEN/BLUE extension
}

FUNC emit_status_signal(person_is_held : BOOL) → StatusSignal {
    S : StatusSignal
    IF person_is_held {
        S.hue        ← PINK
        S.byte_code  ← SIGNAL_PINK
        S.hold_state ← TRUE
        S.send_weight← HALF_HOLD     // −0.5: message held (Phase 23)
        S.rgb_phase17← 0b100         // RED drift (Phase 17)
    } ELSE {
        S.hue        ← GREEN
        S.byte_code  ← SIGNAL_GREEN
        S.hold_state ← FALSE
        S.send_weight← HALF_SEND     // +0.5: message released (Phase 23)
        S.rgb_phase17← 0b010         // GREEN ZKP-verified (Phase 17)
    }
    RETURN S
}

FUNC signal_hue_transition(S : StatusSignal, new_hue : HueSignal) → StatusSignal {
    // Transition PINK → GREEN = release; GREEN → RED = alert; RED → GREEN = resolve
    S.hue ← new_hue
    MATCH new_hue {
        PINK  → { S.hold_state←TRUE;  S.send_weight←HALF_HOLD; S.byte_code←SIGNAL_PINK  }
        GREEN → { S.hold_state←FALSE; S.send_weight←HALF_SEND; S.byte_code←SIGNAL_GREEN }
        RED   → { S.hold_state←TRUE;  S.send_weight←HALF_HOLD; S.byte_code←SIGNAL_RED   }
    }
    RETURN S
}

// ─────────────────────────────────────────────────────────────
// SECTION 25.4 — MASQUERADE WHEEL (WOHEEL — achieve ×2 in ½ time)
// ─────────────────────────────────────────────────────────────

// WOHEEL = Rational Wheel (Phase 22) × Masquerade Protocol.
// Masquerade: comply with bare minimum of an opposing system
//   in order to achieve DOUBLE the bare minimum output.
// "Double the bare minimum" = MASQUERADE_MULTIPLIER = 2.
// "Half the time" = MASQUERADE_TIME_FACTOR = 0.5.
// The wheel moves forward (Ramakrishna will = forward momentum).
// Every party should be moving forward — wheel only rotates forward.
// "We are not complying; we are masquerading" — the mask is the minimum.
// 14 days threshold: at 14 days → community release (half of 28).
// 3 years → 6 years recovery arc: wheel accumulates across time.
// Extends Phase 22 RationalWheel: rotation 1°/cycle + masquerade multiplier.

STRUCT MasqueradeWheel {
    rational_wheel  : RationalWheel    // Phase 22 base wheel
    bare_minimum    : FLOAT            // what their system demands
    achieved        : FLOAT            // = bare_minimum × MASQUERADE_MULTIPLIER
    time_invested   : FLOAT            // actual time used
    time_expected   : FLOAT            // = time_invested × MASQUERADE_TIME_FACTOR
    mask_is_active  : BOOL             // TRUE = masquerade mode on
    forward_only    : BOOL             // wheel never reverses
    detention_days  : INT              // current detention counter
    is_releasable   : BOOL             // TRUE when detention_days >= DETENTION_THRESHOLD
}

FUNC init_masquerade_wheel(base_wheel : RationalWheel,
                            bare_min : FLOAT) → MasqueradeWheel {
    W : MasqueradeWheel
    W.rational_wheel  ← base_wheel
    W.bare_minimum    ← bare_min
    W.achieved        ← bare_min * MASQUERADE_MULTIPLIER
    W.time_invested   ← 0.0
    W.time_expected   ← 0.0
    W.mask_is_active  ← TRUE
    W.forward_only    ← TRUE
    W.detention_days  ← 0
    W.is_releasable   ← FALSE
    RETURN W
}

FUNC apply_masquerade_wheel(W : MasqueradeWheel, time_tick : FLOAT)
        → MasqueradeWheel {
    // Step 1: rotate rational wheel forward (Phase 22)
    W.rational_wheel ← rotate_rational_wheel(W.rational_wheel, degrees=1.0)
    ASSERT W.rational_wheel.current_degrees >= 0.0  // forward only

    // Step 2: accumulate time; achieve ×2 in ½ time
    W.time_invested  ← W.time_invested + time_tick
    W.time_expected  ← W.time_invested * MASQUERADE_TIME_FACTOR
    W.achieved       ← W.bare_minimum * MASQUERADE_MULTIPLIER

    // Step 3: check detention release threshold
    W.detention_days ← W.detention_days + 1
    IF W.detention_days >= DETENTION_THRESHOLD_DAYS {
        W.is_releasable ← TRUE     // 14 days → community release eligible
    }

    RETURN W
}

// ─────────────────────────────────────────────────────────────
// SECTION 25.5 — OHA IWU OPERATIONAL PROTOCOL (arc + reward)
// ─────────────────────────────────────────────────────────────

// OHA (Igbo) = public; IWU (Igbo) = law and order.
// OHA IWU = Public Law and Order — the real-world operational protocol.
// Operations happen in the REAL WORLD, not only on the computer.
// Three components: Operation → Arc → Reward.
//   Operation = what happens in the world (encounter).
//   Arc       = the path taken through the encounter.
//   Reward    = the outcome harvested by completing the arc.
// Encounters ideologies (racism, oppression, detention, injustice)
//   → formalises them into the codec via suffering_to_silicon_encode (Phase 16).
// YES (+1) / NO (0) / MAYBE (−1) = the decision triplet for each encounter.
// INSIGII tag = "STAINLESS_PROTOCOL" — the system's operating identity.

STRUCT OhaIwuEncounter {
    operation   : STRING       // real-world event description
    arc_path    : STRING[]     // sequence of steps taken
    reward      : FLOAT        // outcome value: positive = resolved; negative = unresolved
    encoded     : BITS[]       // suffering_to_silicon_encode(operation) from Phase 16
    decision    : FLOAT        // +1=YES, 0=NO, −1=MAYBE
    hr_tag      : STRING       // human rights tag (Phase 22 HR_TAG family)
    insigii_tag : STRING       // = INSIGII_TAG = "STAINLESS_PROTOCOL"
}

FUNC encode_oha_iwu(operation : STRING, decision : FLOAT,
                     hr_tag : STRING) → OhaIwuEncounter {
    E : OhaIwuEncounter
    E.operation   ← operation
    E.arc_path    ← []
    E.reward      ← 0.0
    E.encoded     ← suffering_to_silicon_encode(operation)   // Phase 16
    E.decision    ← decision
    E.hr_tag      ← hr_tag
    E.insigii_tag ← INSIGII_TAG
    RETURN E
}

FUNC arc_traverse(E : OhaIwuEncounter, steps : STRING[]) → OhaIwuEncounter {
    E.arc_path ← steps
    E.reward   ← FLOAT(len(steps)) * ABS(E.decision)   // reward = arc length × |decision|
    RETURN E
}

// ─────────────────────────────────────────────────────────────
// SECTION 25.6 — OPEN ACCESS TIER (living = mandatory; work = optional)
// ─────────────────────────────────────────────────────────────

// Tier 1 = Open Access = human sovereignty zone.
// Living is NEVER optional (hard pointer — Phase 17 BreathingPointer).
// Work is OPTIONAL (soft pointer — Phase 17 WorkingPointer).
// No agent that creates systemic problems enters Tier 1.
// Three network services for Tier 1 support:
//   Service 1: Primary advocate (from place of origin)
//   Service 2: Backup lawyer (civil exchange team)
//   Service 3: AI symbolic system (human in the loop — AI assistance)
// Advocacy is NEVER optional inside the human rights framework.
// Tier 0 = no access. Tier 1 = full sovereign access.
// Extends Phase 17 breathing/living/working hierarchy.

STRUCT OpenAccessTier {
    tier_level      : INT          // 0 = denied; 1 = Open Access
    living_ptr      : BreathingPointer  // Phase 17: HARD pointer (never null)
    work_ptr        : SystemPointer     // Phase 20: SOFT pointer (may be null)
    advocate_1      : STRING       // primary advocate (origin country)
    advocate_2      : STRING       // backup civil advocate
    ai_assistant    : STRING       // AI symbolic system (human-in-loop)
    advocacy_active : BOOL         // NEVER optional — always TRUE in Tier 1
    problem_agents  : STRING[]     // list of agents denied Tier 1
}

FUNC init_open_access_tier(agent_id : STRING) → OpenAccessTier {
    T : OpenAccessTier
    T.tier_level     ← TIER1_ACCESS
    T.living_ptr     ← init_breathing_pointer()     // Phase 17: hard pointer
    T.work_ptr       ← init_soft_pointer()          // Phase 20: soft pointer
    T.advocate_1     ← "PRIMARY_ADVOCATE_ORIGIN"
    T.advocate_2     ← "BACKUP_CIVIL_EXCHANGE"
    T.ai_assistant   ← "AI_SYMBOLIC_HUMAN_IN_LOOP"
    T.advocacy_active← TRUE                         // never optional
    T.problem_agents ← []
    RETURN T
}

FUNC check_tier1_access(T : OpenAccessTier, agent : STRING) → BOOL {
    IF agent IN T.problem_agents {
        RETURN FALSE    // denied Tier 1 — systemic problem agent
    }
    ASSERT T.living_ptr.is_mandatory == TRUE    // living = hard pointer always
    RETURN TRUE
}

// ─────────────────────────────────────────────────────────────
// SECTION 25.7 — RHETORICAL DOUBLE-NEGATIVE PROOF
// ─────────────────────────────────────────────────────────────

// Rectorial reasoning: "there is no reason NOT to comply."
// Double negation resolution: ¬(¬P) = P.
//   "No reason to withhold freedom" = must grant freedom.
//   "No reason to not give X" = must give X.
// This is the formal logical structure of rectorial advocacy.
// The rhetoric = a live truth, not a lived fact.
//   Lived fact: what has happened in the past (UCH / Persona 0).
//   Live truth:  what must be now (OBI / Persona 1).
//   Rhetoric bridges lived fact → live truth.
// Decision must be ENCOUNTERED (computed, not deferred or ignored).
// In system terms: if no blocking condition exists → the path MUST proceed.

STRUCT RhetoricRectorial {
    proposition     : STRING   // the claim being made
    negation_1      : BOOL     // "no reason NOT to" = ¬(¬P)
    negation_2      : BOOL     // = ¬¬P resolved to P
    resolved        : BOOL     // = DOUBLE_NEGATIVE_RESOLVE = TRUE
    lived_fact      : STRING   // what has occurred (UCH memory)
    live_truth      : STRING   // what must be now (OBI present)
    must_proceed    : BOOL     // TRUE iff no blocking condition found
}

FUNC rhetorical_double_negative(claim : STRING,
                                 blocking_conditions : STRING[]) → RhetoricRectorial {
    R : RhetoricRectorial
    R.proposition ← claim
    R.negation_1  ← TRUE    // "no reason NOT to" applied
    R.negation_2  ← TRUE    // double negation applied
    R.resolved    ← DOUBLE_NEGATIVE_RESOLVE
    R.lived_fact  ← "PAST_STATE_RECORD"
    R.live_truth  ← claim
    // If no blocking conditions exist → must_proceed = TRUE
    R.must_proceed ← (len(blocking_conditions) == 0)
    RETURN R
}

// ─────────────────────────────────────────────────────────────
// SECTION 25.8 — LITIGATION PROTOCOL (Return of Riches)
// ─────────────────────────────────────────────────────────────

// "Return of the Riches" = time-invariant litigation protocol.
// Regardless of how long the process takes → recovery is certain.
// "Doesn't matter how long — you get money out of the system."
// Recovery modelled as convergent series: Σ(1/t) as t → ∞ still converges to value.
// Three-year arc → six-year arc = two complete litigation cycles.
// Financial target: system-defined (arbitrary scale, £12B referenced as example).
// Protocol: document everything → report → council referral → litigation.
// The pen is the sword: handwriting journal = legal documentation.
// Stylus tablet = human extension = open calculation node.
// Connects to Phase 16 suffering_to_silicon (every event encoded, recoverable).

STRUCT LitigationProtocol {
    case_ref        : STRING    // case identifier
    days_elapsed    : INT       // time invested in process
    cycle_count     : INT       // completed 3-year arcs
    recovery_value  : FLOAT     // accumulated target value
    is_certain      : BOOL      // always TRUE (time-invariant certainty)
    encoded_events  : BITS[][]  // suffering_to_silicon_encode of each event
    pen_is_sword    : BOOL      // TRUE: handwriting journal = legal sword
}

FUNC init_litigation_protocol(case_ref : STRING) → LitigationProtocol {
    L : LitigationProtocol
    L.case_ref       ← case_ref
    L.days_elapsed   ← 0
    L.cycle_count    ← 0
    L.recovery_value ← 0.0
    L.is_certain     ← TRUE           // time-invariant: recovery always comes
    L.encoded_events ← []
    L.pen_is_sword   ← TRUE           // pen = sword (documentation = legal force)
    RETURN L
}

FUNC litigation_record_event(L : LitigationProtocol, event : STRING,
                               value : FLOAT) → LitigationProtocol {
    L.encoded_events  ← APPEND(L.encoded_events, suffering_to_silicon_encode(event))
    L.recovery_value  ← L.recovery_value + value
    L.days_elapsed    ← L.days_elapsed + 1
    IF L.days_elapsed MOD (365 * 3) == 0 {
        L.cycle_count ← L.cycle_count + 1    // completed 3-year arc
    }
    RETURN L
}

// ─────────────────────────────────────────────────────────────
// SECTION 25.9 — WHEEL RETICLE (Phase 22 Rational Wheel × Targeting)
// ─────────────────────────────────────────────────────────────

// Wheel Reticle = Rational Wheel (Phase 22) extended with targeting (reticle = aim).
// The wheel rotates forward; the reticle aims at the next objective.
// "Which of the return? Think that's what another protocol name and
//  the wheel model, the wheel reticle recently national model."
// Reticle: 0° = CH0 transmit; 120° = CH1 receive; 240° = CH2 verify (Phase 22).
// Masquerade added: at each 120° arc, the masquerade multiplier doubles output.
// Reticle lock: when wheel reaches 360° (full cycle) → target is confirmed.
// Every rotation step = one anti-pop increment (10%, Phase 24).
// Integration of: Phase 22 rational wheel + Phase 25 masquerade + Phase 24 anti-pop.

STRUCT WheelReticle {
    rational_wheel  : RationalWheel     // Phase 22 base
    masquerade      : MasqueradeWheel   // Phase 25 masquerade overlay
    reticle_angle   : FLOAT             // current aim angle (0° → 360°)
    target_locked   : BOOL              // TRUE when reticle completes full cycle
    channel_arc     : FLOAT             // = 120° per channel (Phase 22)
    antipop         : AntiPopProtocol   // Phase 24: 10% growth per step
}

FUNC wheel_reticle_target(WR : WheelReticle) → WheelReticle {
    // Rotate wheel 1° (Phase 22)
    WR.rational_wheel ← rotate_rational_wheel(WR.rational_wheel, degrees=1.0)
    WR.reticle_angle  ← WR.rational_wheel.current_degrees

    // Apply masquerade multiplier at each 120° channel boundary
    IF WR.reticle_angle MOD 120.0 == 0.0 {
        WR.masquerade ← apply_masquerade_wheel(WR.masquerade, time_tick=1.0)
    }

    // Anti-pop step at each 36° (10% of 360°)
    IF WR.reticle_angle MOD 36.0 == 0.0 {
        WR.antipop ← antipop_step(WR.antipop)    // Phase 24
    }

    // Lock reticle when full 360° cycle complete
    IF WR.reticle_angle >= 360.0 {
        WR.target_locked ← TRUE
        // Emit Phase 22 consensus at 360°
        emit_consensus_message(
            hr_tag    = "NSIGII_HR_VERIFIED",
            annotation= "WHEEL_RETICLE_LOCKED_360"
        )
    }

    RETURN WR
}

// ─────────────────────────────────────────────────────────────
// SECTION 25.10 — HUMAN RIGHTS TABLET (Stylus + Handwriting Journal)
// ─────────────────────────────────────────────────────────────

// Three devices allowed in the MMUKO-OS human rights framework:
//   Device 0: MUKO tablet (human extension — stylus tablet = pen+paper digital)
//   Device 1: Human tablet (micro-tablet: journal everywhere you go)
//   Device 2: Personal laptop (one personal laptop of choice, free of charge)
// Tablet + stylus = handwriting = "open calculation" — the system checks
//   what is written and feeds it back as structured data.
// Journal is mandatory: document what you do, how you got there, what happened.
// Food, shelter, advocacy = non-optional (hard pointers).
// Phones: allowed for communication, NOT for lock-down.
// AI system = "symbolic system with human being in the loop."

STRUCT HumanRightsTablet {
    device_id       : INT       // 0 = MUKO tablet, 1 = Human tablet, 2 = Laptop
    has_stylus      : BOOL      // TRUE for devices 0 and 1
    journal_entries : STRING[]  // all handwritten journal entries
    handwriting_calc: FLOAT     // open calculation: handwriting → structured data
    ai_symbolic_loop: BOOL      // TRUE = AI symbolic assistant active (human in loop)
    is_locked       : BOOL      // FALSE: never lock down a communication device
}

FUNC init_hr_tablet(device_id : INT) → HumanRightsTablet {
    T : HumanRightsTablet
    T.device_id        ← device_id
    T.has_stylus       ← (device_id IN [0, 1])
    T.journal_entries  ← []
    T.handwriting_calc ← 0.0
    T.ai_symbolic_loop ← TRUE          // always human-in-loop
    T.is_locked        ← FALSE         // never locked down
    RETURN T
}

FUNC journal_write(T : HumanRightsTablet, entry : STRING) → HumanRightsTablet {
    T.journal_entries  ← APPEND(T.journal_entries, entry)
    // Open calculation: hash entry → contributes to handwriting_calc
    T.handwriting_calc ← T.handwriting_calc + FLOAT(len(entry))
    RETURN T
}

// ─────────────────────────────────────────────────────────────
// SECTION 25.11 — PHASE 25 INTEGRATION FUNCTION
// ─────────────────────────────────────────────────────────────

FUNC phase25_rectorial_reasoning() → VOID {

    // Step 1: Invoke phases 0–24
    phase24_lambda_lapis_calcus()   // (implicitly invokes 0–23)

    // Step 2: Initialise tripolar agent (Me / Myself / I)
    agent : TripolarAgent ← init_tripolar_agent()
    ASSERT agent.present.is_active == TRUE      // OBI = King = here-and-now
    ASSERT agent.past.agent_binding  == UCH
    ASSERT agent.future.agent_binding== EZE

    // Step 3: Collapse future into now ("The future is now")
    agent ← collapse_future_to_now(agent)
    ASSERT agent.future_is_now == TRUE

    // Step 4: Compute sensory matrix (5+5=10; 5×5=25)
    senses : SensoryMatrix ← compute_sensory_matrix()
    ASSERT senses.bilateral == SENSORY_PAIR        // 10
    ASSERT senses.total     == SENSORY_MATRIX      // 25
    ASSERT senses.direction_ok == TRUE

    // Step 5: Emit status signal (initialise as HELD → transition to FREE)
    sig : StatusSignal ← emit_status_signal(person_is_held=TRUE)   // PINK
    sig ← signal_hue_transition(sig, new_hue=GREEN)                 // → FREE

    // Step 6: Initialise masquerade wheel on Phase 22 rational wheel
    mw : MasqueradeWheel ← init_masquerade_wheel(
            base_wheel = mmuko_rational_wheel,
            bare_min   = 1.0)
    // Run masquerade for 14 days to verify release threshold
    FOR day IN 1..DETENTION_THRESHOLD_DAYS {
        mw ← apply_masquerade_wheel(mw, time_tick=1.0)
    }
    ASSERT mw.is_releasable == TRUE     // 14 days → community release eligible
    ASSERT mw.achieved      == 2.0      // ×2 bare minimum achieved

    // Step 7: Encode OHA IWU real-world operation
    encounter : OhaIwuEncounter ← encode_oha_iwu(
        operation = "UNLAWFUL_DETENTION",
        decision  = 1.0,     // YES = must be resolved
        hr_tag    = "NSIGII_HR_VERIFIED")
    encounter ← arc_traverse(encounter,
        steps = ["DOCUMENT", "REPORT", "ADVOCATE", "LITIGATE", "RELEASE"])

    // Step 8: Open Access Tier 1 verification
    tier : OpenAccessTier ← init_open_access_tier(agent_id="NNAMDI")
    access_ok : BOOL ← check_tier1_access(tier, agent="NNAMDI")
    ASSERT access_ok == TRUE
    ASSERT tier.living_ptr.is_mandatory == TRUE     // living = hard pointer ALWAYS

    // Step 9: Rhetorical double-negative proof
    proof : RhetoricRectorial ← rhetorical_double_negative(
        claim                = "GRANT_FREEDOM",
        blocking_conditions  = [])    // no valid blocking conditions → must proceed
    ASSERT proof.must_proceed == TRUE
    ASSERT proof.resolved     == DOUBLE_NEGATIVE_RESOLVE

    // Step 10: Litigation protocol — begin recording
    lit : LitigationProtocol ← init_litigation_protocol(case_ref="OBINexus_HR_001")
    lit ← litigation_record_event(lit, event="DETENTION_DAY_1", value=1.0)
    ASSERT lit.is_certain  == TRUE     // time-invariant: recovery always comes
    ASSERT lit.pen_is_sword== TRUE

    // Step 11: Initialise wheel reticle (Phase 22 × Phase 25 × Phase 24)
    wr : WheelReticle ← {
        rational_wheel = mmuko_rational_wheel,
        masquerade     = mw,
        reticle_angle  = 0.0,
        target_locked  = FALSE,
        channel_arc    = 120.0,
        antipop        = antipop_init()
    }
    // Advance wheel to 360° lock (full rectorial cycle)
    FOR tick IN 1..360 {
        wr ← wheel_reticle_target(wr)
    }
    ASSERT wr.target_locked       == TRUE
    ASSERT wr.antipop.level       == 1.0    // 100% stability at 360°
    ASSERT wr.masquerade.achieved == 2.0    // ×2 output confirmed

    // Step 12: Human Rights Tablet — initialise journal
    tablet : HumanRightsTablet ← init_hr_tablet(device_id=1)
    tablet ← journal_write(tablet, "Session 25 — Rectorial Reasoning initiated.")
    tablet ← journal_write(tablet, "Wheel reticle locked at 360°.")
    ASSERT tablet.is_locked == FALSE        // never locked

    // Step 13: HR broadcast
    emit_consensus_message(
        hr_tag     = "NSIGII_HR_VERIFIED",
        annotation = "RECTORIAL_REASONING_COMPLETE_WHEEL_LOCKED"
    )
}

// ─────────────────────────────────────────────────────────────
// SECTION 25.12 — PROGRAM ENTRY (Phases 0–25)
// ─────────────────────────────────────────────────────────────

PROGRAM mmuko_os_rectorial_reasoning {

    // Prior phase bootchain (0–24)
    CALL phase_0_memory_init()
    CALL phase_1_boot_sequence()
    CALL phase_2_cubit_memory()
    CALL phase_3_state_machine()
    CALL phase_4_polar_addressing()
    CALL phase_5_em_field_init()
    CALL phase_6_zkp_setup()
    CALL phase_7_rift_toolchain()
    CALL phase_8_nlink_polybuild()
    CALL phase_9_hold_decay()
    CALL phase_10_geocore_init()
    CALL phase_11_agent_triad()
    CALL phase_12_semanticx()
    CALL phase_13_lib_static_em()
    CALL phase_14_oxstar_half()
    CALL phase_15_spring_coil()
    CALL phase_16_nsigii_codec()
    CALL phase_17_here_and_now()
    CALL phase_18_rwx_verification()
    CALL phase_19_loopback_polar()
    CALL phase_20_spring_echo_verifier()
    CALL phase_21_spring_chalkboard_verify()
    CALL phase_22_trident_c2_hrv()
    CALL phase_23_drone_delivery()
    CALL phase_24_lambda_lapis_calcus()

    // Phase 25 — Rectorial Reasoning Rational Wheel Framework
    CALL phase25_rectorial_reasoning()

    HALT
}