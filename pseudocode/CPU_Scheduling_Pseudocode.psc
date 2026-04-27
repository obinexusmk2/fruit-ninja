// ============================================================
//  CPU SCHEDULING ALGORITHMS — PSEUDOCODE
//  Based on OS Scheduling Documentation
//  OBINexus / Filter-Flash Epsilon Matrix Reference
// ============================================================
//
//  SHARED DATA STRUCTURES
// ============================================================

STRUCT Process:
    id            : STRING
    arrival_time  : INT
    burst_time    : INT
    remaining_time: INT       // used in preemptive algorithms
    priority      : INT       // lower number = higher priority
    completion_time: INT
    turnaround_time: INT
    waiting_time  : INT
    response_time : INT
    started       : BOOL

// ============================================================
//  SHARED UTILITY FUNCTIONS
// ============================================================

FUNCTION compute_metrics(process):
    process.turnaround_time = process.completion_time - process.arrival_time
    process.waiting_time    = process.turnaround_time  - process.burst_time
    RETURN process

FUNCTION average_waiting_time(process_list):
    total = 0
    FOR each p IN process_list:
        total = total + p.waiting_time
    RETURN total / LENGTH(process_list)

FUNCTION average_turnaround_time(process_list):
    total = 0
    FOR each p IN process_list:
        total = total + p.turnaround_time
    RETURN total / LENGTH(process_list)


// ============================================================
//  1. FCFS — FIRST COME, FIRST SERVE  (Non-Preemptive)
// ============================================================
//  Allocation : order of arrival
//  Preemption : NO
//  Starvation : NO
//  Complexity : O(n log n)  — sort step
// ============================================================

FUNCTION FCFS(process_list):
    SORT process_list BY arrival_time ASC
    current_time = 0

    FOR each p IN process_list:
        IF current_time < p.arrival_time:
            current_time = p.arrival_time          // CPU idle gap

        p.completion_time = current_time + p.burst_time
        current_time      = p.completion_time
        compute_metrics(p)

    PRINT Gantt chart
    PRINT average_waiting_time(process_list)
    PRINT average_turnaround_time(process_list)


// ============================================================
//  2. SJF — SHORTEST JOB FIRST  (Non-Preemptive)
// ============================================================
//  Allocation : lowest burst_time among ready processes
//  Preemption : NO
//  Starvation : YES  (long jobs may starve)
//  Complexity : O(n²)
// ============================================================

FUNCTION SJF(process_list):
    current_time  = 0
    completed     = 0
    n             = LENGTH(process_list)
    visited[]     = ARRAY of FALSE, size n

    WHILE completed < n:
        // Build ready queue: arrived AND not yet completed
        ready = []
        FOR each p IN process_list:
            IF p.arrival_time <= current_time AND NOT visited[p.id]:
                APPEND p TO ready

        IF ready IS EMPTY:
            current_time = current_time + 1
            CONTINUE

        // Select process with minimum burst_time
        selected = MIN(ready, KEY = burst_time)

        selected.completion_time = current_time + selected.burst_time
        current_time             = selected.completion_time
        visited[selected.id]     = TRUE
        completed                = completed + 1
        compute_metrics(selected)

    PRINT average_waiting_time(process_list)
    PRINT average_turnaround_time(process_list)


// ============================================================
//  3. SRTF — SHORTEST REMAINING TIME FIRST  (Preemptive SJF)
// ============================================================
//  Allocation : lowest remaining_time at each time unit
//  Preemption : YES
//  Starvation : YES
//  Complexity : O(n²)
// ============================================================

FUNCTION SRTF(process_list):
    FOR each p IN process_list:
        p.remaining_time = p.burst_time
        p.started        = FALSE

    current_time = 0
    completed    = 0
    n            = LENGTH(process_list)

    WHILE completed < n:
        // Build ready queue
        ready = []
        FOR each p IN process_list:
            IF p.arrival_time <= current_time AND p.remaining_time > 0:
                APPEND p TO ready

        IF ready IS EMPTY:
            current_time = current_time + 1
            CONTINUE

        // Select shortest remaining time
        selected = MIN(ready, KEY = remaining_time)

        IF NOT selected.started:
            selected.response_time = current_time - selected.arrival_time
            selected.started       = TRUE

        selected.remaining_time = selected.remaining_time - 1
        current_time            = current_time + 1

        IF selected.remaining_time == 0:
            selected.completion_time = current_time
            completed = completed + 1
            compute_metrics(selected)

    PRINT average_waiting_time(process_list)
    PRINT average_turnaround_time(process_list)


// ============================================================
//  4. ROUND ROBIN  (Preemptive)
// ============================================================
//  Allocation : cyclic order with fixed time quantum TQ
//  Preemption : YES
//  Starvation : NO
//  Complexity : O(n)  per quantum cycle
// ============================================================

FUNCTION RoundRobin(process_list, time_quantum):
    SORT process_list BY arrival_time ASC
    FOR each p IN process_list:
        p.remaining_time = p.burst_time
        p.started        = FALSE

    queue        = EMPTY QUEUE
    current_time = 0
    completed    = 0
    n            = LENGTH(process_list)
    index        = 0                         // next un-enqueued process pointer

    // Seed queue with first arriving process
    ENQUEUE process_list[0] TO queue
    index = 1

    WHILE completed < n:
        IF queue IS EMPTY:
            current_time = process_list[index].arrival_time
            ENQUEUE process_list[index] TO queue
            index = index + 1
            CONTINUE

        p = DEQUEUE queue

        IF NOT p.started:
            p.response_time = current_time - p.arrival_time
            p.started       = TRUE

        exec_slice = MIN(p.remaining_time, time_quantum)
        current_time        = current_time + exec_slice
        p.remaining_time    = p.remaining_time - exec_slice

        // Enqueue newly arrived processes during this slice
        WHILE index < n AND process_list[index].arrival_time <= current_time:
            ENQUEUE process_list[index] TO queue
            index = index + 1

        IF p.remaining_time == 0:
            p.completion_time = current_time
            completed         = completed + 1
            compute_metrics(p)
        ELSE:
            ENQUEUE p TO queue          // re-queue for next slice

    PRINT average_waiting_time(process_list)
    PRINT average_turnaround_time(process_list)


// ============================================================
//  5a. PRIORITY SCHEDULING — Non-Preemptive
// ============================================================
//  Allocation : highest priority (lowest priority number)
//  Preemption : NO
//  Starvation : YES  — use Aging to mitigate
//  Complexity : O(n²)
// ============================================================

FUNCTION PriorityNonPreemptive(process_list):
    current_time = 0
    completed    = 0
    n            = LENGTH(process_list)
    done[]       = ARRAY of FALSE, size n

    WHILE completed < n:
        ready = []
        FOR each p IN process_list WHERE NOT done[p.id]:
            IF p.arrival_time <= current_time:
                APPEND p TO ready

        IF ready IS EMPTY:
            current_time = current_time + 1
            CONTINUE

        selected = MIN(ready, KEY = priority)   // lower number = higher priority

        selected.completion_time = current_time + selected.burst_time
        current_time             = selected.completion_time
        done[selected.id]        = TRUE
        completed                = completed + 1
        compute_metrics(selected)

    PRINT average_waiting_time(process_list)


// ============================================================
//  5b. PRIORITY SCHEDULING — Preemptive
// ============================================================
//  Allocation : highest priority process at every tick
//  Preemption : YES  — new higher-priority arrival interrupts
//  Starvation : YES
// ============================================================

FUNCTION PriorityPreemptive(process_list):
    FOR each p IN process_list:
        p.remaining_time = p.burst_time
        p.started        = FALSE

    current_time = 0
    completed    = 0
    n            = LENGTH(process_list)

    WHILE completed < n:
        ready = []
        FOR each p IN process_list:
            IF p.arrival_time <= current_time AND p.remaining_time > 0:
                APPEND p TO ready

        IF ready IS EMPTY:
            current_time = current_time + 1
            CONTINUE

        selected = MIN(ready, KEY = priority)

        IF NOT selected.started:
            selected.response_time = current_time - selected.arrival_time
            selected.started       = TRUE

        selected.remaining_time = selected.remaining_time - 1
        current_time            = current_time + 1

        IF selected.remaining_time == 0:
            selected.completion_time = current_time
            completed = completed + 1
            compute_metrics(selected)

    PRINT average_waiting_time(process_list)


// ============================================================
//  AGING — Starvation Prevention Helper
//  Apply periodically inside priority schedulers
// ============================================================

FUNCTION apply_aging(ready_queue, aging_interval, current_time):
    FOR each p IN ready_queue:
        wait_so_far = current_time - p.arrival_time - (p.burst_time - p.remaining_time)
        IF wait_so_far MOD aging_interval == 0 AND wait_so_far > 0:
            p.priority = p.priority - 1    // boost priority over time
    RETURN ready_queue


// ============================================================
//  6. HRRN — HIGHEST RESPONSE RATIO NEXT  (Non-Preemptive)
// ============================================================
//  Response Ratio = (waiting_time + burst_time) / burst_time
//  Allocation : highest response ratio
//  Preemption : NO
//  Starvation : NO  — waiting time increases ratio over time
//  Complexity : O(n²)
// ============================================================

FUNCTION HRRN(process_list):
    current_time = 0
    completed    = 0
    n            = LENGTH(process_list)
    done[]       = ARRAY of FALSE, size n

    WHILE completed < n:
        ready = []
        FOR each p IN process_list WHERE NOT done[p.id]:
            IF p.arrival_time <= current_time:
                wait = current_time - p.arrival_time
                p.response_ratio = (wait + p.burst_time) / p.burst_time
                APPEND p TO ready

        IF ready IS EMPTY:
            current_time = current_time + 1
            CONTINUE

        selected = MAX(ready, KEY = response_ratio)

        selected.completion_time = current_time + selected.burst_time
        current_time             = selected.completion_time
        done[selected.id]        = TRUE
        completed                = completed + 1
        compute_metrics(selected)

    PRINT average_waiting_time(process_list)


// ============================================================
//  7. MLQ — MULTI-LEVEL QUEUE  (Non-Preemptive within level)
// ============================================================
//  Queues have fixed priorities; processes are permanently
//  assigned to a queue based on type/class.
//  Starvation : YES  — lower queues may never run
// ============================================================

FUNCTION MLQ(queue_list, process_list):
    // queue_list: ordered list of queues, index 0 = highest priority
    // Each process carries a queue_level attribute

    FOR each p IN process_list:
        ASSIGN p TO queue_list[p.queue_level]

    current_time = 0
    completed    = 0
    n            = LENGTH(process_list)

    WHILE completed < n:
        selected = NIL
        FOR each q IN queue_list (high priority first):
            ready = [p IN q WHERE p.arrival_time <= current_time]
            IF ready IS NOT EMPTY:
                // Within each queue use FCFS or RR depending on queue policy
                selected = DEQUEUE_POLICY(ready, q.scheduling_policy)
                BREAK

        IF selected == NIL:
            current_time = current_time + 1
            CONTINUE

        selected.completion_time = current_time + selected.burst_time
        current_time             = selected.completion_time
        completed                = completed + 1
        compute_metrics(selected)

    PRINT average_waiting_time(process_list)


// ============================================================
//  8. MFLQ — MULTI-LEVEL FEEDBACK QUEUE  (Preemptive)
// ============================================================
//  Processes can move BETWEEN queues based on behavior.
//  High-burst processes demoted; low-burst processes promoted.
//  Starvation : NO  — aging promotes starving processes
//  Complexity : depends on TQ sizes and number of levels
// ============================================================

FUNCTION MFLQ(process_list, num_levels, time_quanta[]):
    // time_quanta[i] = TQ for queue level i
    // Level 0 = highest priority, shortest TQ
    // Level num_levels-1 = lowest priority (FCFS)

    queues[] = ARRAY of EMPTY QUEUE, size num_levels

    FOR each p IN process_list:
        p.remaining_time  = p.burst_time
        p.queue_level     = 0           // all start in highest queue
        p.started         = FALSE

    current_time = 0
    completed    = 0
    n            = LENGTH(process_list)

    WHILE completed < n:
        // Admit newly arrived processes to queue 0
        FOR each p IN process_list:
            IF p.arrival_time == current_time AND p.remaining_time == p.burst_time:
                ENQUEUE p TO queues[0]

        // Find highest non-empty queue
        selected_queue_level = NIL
        FOR level FROM 0 TO num_levels - 1:
            IF queues[level] IS NOT EMPTY:
                selected_queue_level = level
                BREAK

        IF selected_queue_level == NIL:
            current_time = current_time + 1
            CONTINUE

        p  = DEQUEUE queues[selected_queue_level]
        tq = time_quanta[selected_queue_level]

        IF NOT p.started:
            p.response_time = current_time - p.arrival_time
            p.started       = TRUE

        exec_slice       = MIN(p.remaining_time, tq)
        current_time     = current_time + exec_slice
        p.remaining_time = p.remaining_time - exec_slice

        // Admit new arrivals during this slice
        FOR each q IN process_list:
            IF q.arrival_time <= current_time
               AND q.remaining_time == q.burst_time
               AND q NOT IN any queue:
                ENQUEUE q TO queues[0]

        IF p.remaining_time == 0:
            p.completion_time = current_time
            completed         = completed + 1
            compute_metrics(p)
        ELSE:
            // Demote: if process used full quantum, move down one level
            IF exec_slice == tq:
                next_level = MIN(selected_queue_level + 1, num_levels - 1)
                p.queue_level = next_level
                ENQUEUE p TO queues[next_level]
            ELSE:
                // Process voluntarily yielded (I/O); keep at current level
                ENQUEUE p TO queues[selected_queue_level]

        // AGING: promote long-waiting processes in lower queues
        FOR level FROM 1 TO num_levels - 1:
            FOR each p IN queues[level]:
                IF (current_time - p.last_enqueue_time) > AGING_THRESHOLD:
                    MOVE p TO queues[level - 1]

    PRINT average_waiting_time(process_list)
    PRINT average_turnaround_time(process_list)


// ============================================================
//  METRICS SUMMARY PRINTER
// ============================================================

FUNCTION print_summary(process_list):
    PRINT "PID | Arrival | Burst | Completion | TAT | WT | RT"
    FOR each p IN process_list:
        PRINT p.id, p.arrival_time, p.burst_time,
              p.completion_time, p.turnaround_time,
              p.waiting_time,    p.response_time
    PRINT "Avg WT  :", average_waiting_time(process_list)
    PRINT "Avg TAT :", average_turnaround_time(process_list)

// ============================================================
//  END OF FILE
// ============================================================
