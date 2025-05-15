# Jukebox Tempo - Automated Testing

This directory contains automated tests for the Jukebox Tempo application, including memory monitoring and browser automation.

## Prerequisites

1. Python 3.7+
2. Chrome browser installed
3. Node.js and npm (for running the development server)
4. Python packages listed in `test_requirements.txt`

## Setup

1. Install the required Python packages:
   ```bash
   pip install -r test_requirements.txt
   ```

## Running Tests

1. To run tests in headless mode (no browser UI):
   ```bash
   python test_player.py --headless
   ```

2. To run tests with browser UI visible:
   ```bash
   python test_player.py
   ```

## Test Output

- Screenshots are saved in the `screenshots/` directory
- Memory usage is logged to the console
- Test results are printed to the console

## Test Cases

1. **Initial Load Test**:
   - Verifies the application loads correctly
   - Takes a screenshot of the initial page
   - Logs memory usage

2. **Player Window Test**:
   - Clicks the player button to open the player window
   - Switches to the player window
   - Verifies the player loads
   - Takes a screenshot
   - Logs memory usage

## Memory Monitoring

The test script monitors memory usage throughout the test run and reports:
- Current memory usage at each test step
- Maximum memory usage during the test
- A history of memory usage over time

## Debugging

If tests fail:
1. Check the console output for error messages
2. Review screenshots in the `screenshots/` directory
3. Check the memory usage history for potential leaks

## Notes

- The test script automatically starts and stops the development server
- All browser windows are automatically closed when tests complete
- The script handles cleanup of all resources, even if tests fail
