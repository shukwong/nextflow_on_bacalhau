/*
 * Copyright 2024, Nextflow Contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package nextflow.executor

import groovy.transform.CompileStatic
import groovy.util.logging.Slf4j
import nextflow.Session
import nextflow.processor.TaskHandler
import nextflow.processor.TaskPollingMonitor
import nextflow.util.Duration

/**
 * Polling monitor for Bacalhau jobs.
 *
 * FIX #11 / #10: {@link AbstractGridExecutor#createTaskMonitor()} defaults to
 * a 5-second poll interval tuned for HPC schedulers.  Bacalhau jobs typically
 * run for minutes to hours, so polling every 5 seconds generates unnecessary
 * API traffic.  This subclass overrides the default to 30 seconds and wires
 * itself into {@link BacalhauExecutor#createTaskMonitor()}.
 *
 * <h3>Configuration</h3>
 * Poll interval and queue size can be tuned in {@code nextflow.config}:
 * <pre>
 * executor {
 *     $bacalhau {
 *         pollInterval = '30 sec'   // how often to check job status
 *         queueSize    = 100        // max concurrent Bacalhau jobs
 *         dumpInterval = '5 min'    // how often to log queue diagnostics
 *     }
 * }
 * </pre>
 *
 * @author Nextflow Contributors
 */
@Slf4j
@CompileStatic
class BacalhauTaskMonitor extends TaskPollingMonitor {

    /** 30 seconds — appropriate for distributed, long-running jobs. */
    static final Duration DEFAULT_POLL_INTERVAL = Duration.of('30sec')

    /** Default maximum number of concurrently tracked Bacalhau jobs. */
    static final int DEFAULT_QUEUE_SIZE = 100

    // -------------------------------------------------------------------------
    // Factory
    // -------------------------------------------------------------------------

    /**
     * Create a monitor for a Bacalhau executor session.
     *
     * Actual poll interval, dump interval and queue size are resolved from
     * {@code nextflow.config}'s {@code executor.$bacalhau} block with the
     * constants above as fallbacks.
     *
     * @param session The active Nextflow session.
     */
    static BacalhauTaskMonitor create(Session session) {
        assert session

        final Duration pollInterval = session.getPollInterval('bacalhau', DEFAULT_POLL_INTERVAL)
        final Duration dumpInterval = session.getMonitorDumpInterval('bacalhau')
        final int      capacity     = session.getQueueSize('bacalhau', DEFAULT_QUEUE_SIZE)

        log.debug """\
            BacalhauTaskMonitor settings
              pollInterval : $pollInterval
              dumpInterval : $dumpInterval
              capacity     : $capacity
            """.stripIndent(true)

        // TaskPollingMonitor's protected constructor accepts a named-param Map.
        return new BacalhauTaskMonitor([
            session     : session,
            name        : 'bacalhau',
            pollInterval: pollInterval,
            dumpInterval: dumpInterval,
            capacity    : capacity,
        ])
    }

    /**
     * Delegate to the {@link TaskPollingMonitor} Map-based constructor.
     *
     * Keys: {@code session} (required), {@code name} (required),
     * {@code pollInterval} (required), {@code dumpInterval} (optional),
     * {@code capacity} (optional).
     */
    protected BacalhauTaskMonitor(Map params) {
        super(params)
    }

    // -------------------------------------------------------------------------
    // Override hook — future batch-polling optimisation point
    // -------------------------------------------------------------------------

    /**
     * Check whether a handler's job is still active.
     *
     * Currently delegates directly to the handler (one API call per job).
     * A future optimisation can override this to batch-poll via
     * {@code bacalhau job list} and cache results within a single poll cycle,
     * reducing the number of CLI invocations from O(jobs) to O(1).
     */
    @Override
    protected boolean checkTaskStatus(TaskHandler handler) {
        log.trace "Checking status for task: ${handler.task?.name}"
        return super.checkTaskStatus(handler)
    }
}
