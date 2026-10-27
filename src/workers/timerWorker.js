/**
 * Timer Web Worker
 *
 * Runs a 1-second interval timer in a background thread
 * This survives tab-switching and screen lock on most browsers,
 * unlike setInterval in the main thread which can be throttled
 *
 * Messages:
 *   Main -> Worker:
 *     { command: 'start' }  - Begin counting
 *     { command: 'stop' }   - Pause counting
 *     { command: 'reset' }  - Stop and zero out
 *
 *   Worker -> Main:
 *     { type: 'tick', seconds: N }  - Fires every second with elapsed count
 */

let intervalId = null
let seconds = 0

self.onmessage = function (event) {
  const { command, initialSeconds } = event.data

  switch (command) {
    case 'start':
      // Resume from a given second count if provided
      if (typeof initialSeconds === 'number') {
        seconds = initialSeconds
      }
      // Clear any existing interval to prevent duplicates
      if (intervalId) clearInterval(intervalId)

      intervalId = setInterval(() => {
        seconds += 1
        self.postMessage({ type: 'tick', seconds })
      }, 1000)
      break

    case 'stop':
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      break

    case 'reset':
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      seconds = 0
      self.postMessage({ type: 'tick', seconds: 0 })
      break

    default:
      break
  }
}
