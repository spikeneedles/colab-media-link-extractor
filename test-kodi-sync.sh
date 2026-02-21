#!/bin/bash

# ============================================================================
# Kodi Sync Endpoint - Automated Test Suite
# ============================================================================
# Run all tests: ./test-kodi-sync.sh all
# Run single test: ./test-kodi-sync.sh test1
# View results: ./test-kodi-sync.sh results
# Clean up: ./test-kodi-sync.sh cleanup
# ============================================================================

set -e

# Configuration
BASE_URL="${KODI_SYNC_URL:-http://localhost:3001/api/kodi-sync}"
RESULTS_DIR="./kodi-sync-test-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEST_LOG="$RESULTS_DIR/test_run_$TIMESTAMP.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Initialize
mkdir -p "$RESULTS_DIR"
touch "$TEST_LOG"

# Helper functions
log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$TEST_LOG"
}

success() {
    echo -e "${GREEN}✓ $1${NC}" | tee -a "$TEST_LOG"
}

fail() {
    echo -e "${RED}✗ $1${NC}" | tee -a "$TEST_LOG"
}

warn() {
    echo -e "${YELLOW}⚠ $1${NC}" | tee -a "$TEST_LOG"
}

divider() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$TEST_LOG"
}

# Check if server is running
check_server() {
    log "Checking if Kodi Sync service is running..."
    if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
        fail "Service not running at $BASE_URL"
        fail "Start the backend server: cd backend && npm run dev"
        exit 1
    fi
    success "Service is running at $BASE_URL"
}

# Test 1: Health Check
test_health() {
    divider
    log "TEST 1: Health Check"
    divider
    
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -eq 200 ]; then
        success "Health check passed (HTTP $http_code)"
        echo "$body" | jq . >> "$TEST_LOG" 2>/dev/null || echo "$body" >> "$TEST_LOG"
        return 0
    else
        fail "Health check failed (HTTP $http_code)"
        echo "$body" >> "$TEST_LOG"
        return 1
    fi
}

# Test 2: Single URL Sync
test_single_url() {
    divider
    log "TEST 2: Single URL Sync"
    divider
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/receive" \
        -H "Content-Type: application/json" \
        -d '{
            "source_url": "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u",
            "kodi_session_id": "test-single-'$TIMESTAMP'",
            "kodi_source": "Test Addon",
            "media_type": "playlist",
            "metadata": {
                "title": "Test Playlist",
                "category": "Live TV"
            }
        }')
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -eq 202 ]; then
        success "Single URL submission accepted (HTTP $http_code)"
        JOB_ID=$(echo "$body" | jq -r '.job_id')
        echo "$body" | jq . >> "$TEST_LOG"
        echo "$JOB_ID" > "$RESULTS_DIR/last_job_id.txt"
        return 0
    else
        fail "Single URL submission failed (HTTP $http_code)"
        echo "$body" >> "$TEST_LOG"
        return 1
    fi
}

# Test 3: Job Status Polling
test_job_status() {
    divider
    log "TEST 3: Job Status Polling"
    divider
    
    if [ ! -f "$RESULTS_DIR/last_job_id.txt" ]; then
        warn "No previous job ID found, skipping status test"
        return 1
    fi
    
    JOB_ID=$(cat "$RESULTS_DIR/last_job_id.txt")
    log "Polling job status for: $JOB_ID"
    
    for i in {1..6}; do
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL/status/$JOB_ID")
        http_code=$(echo "$response" | tail -n 1)
        body=$(echo "$response" | head -n -1)
        
        if [ "$http_code" -eq 200 ]; then
            progress=$(echo "$body" | jq -r '.progress')
            status=$(echo "$body" | jq -r '.status')
            log "Poll #$i - Status: $status | Progress: $progress%"
            
            if [ "$status" == "completed" ]; then
                success "Job completed!"
                echo "$body" | jq . >> "$TEST_LOG"
                return 0
            fi
        else
            fail "Status check failed (HTTP $http_code)"
            return 1
        fi
        
        if [ $i -lt 6 ]; then
            sleep 2
        fi
    done
    
    return 0
}

# Test 4: Get Results (JSON)
test_results_json() {
    divider
    log "TEST 4: Get Results - JSON Format"
    divider
    
    if [ ! -f "$RESULTS_DIR/last_job_id.txt" ]; then
        warn "No previous job ID found, skipping results test"
        return 1
    fi
    
    JOB_ID=$(cat "$RESULTS_DIR/last_job_id.txt")
    
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/results/$JOB_ID?format=json")
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -eq 200 ]; then
        success "Results retrieved in JSON format (HTTP $http_code)"
        echo "$body" | jq . > "$RESULTS_DIR/results_${JOB_ID}.json"
        success "Results saved to: results_${JOB_ID}.json"
        return 0
    elif [ "$http_code" -eq 202 ]; then
        warn "Job still processing (HTTP 202), results not yet available"
        return 0
    else
        fail "Results retrieval failed (HTTP $http_code)"
        echo "$body" >> "$TEST_LOG"
        return 1
    fi
}

# Test 5: Export as M3U
test_results_m3u() {
    divider
    log "TEST 5: Export Results - M3U Format"
    divider
    
    if [ ! -f "$RESULTS_DIR/last_job_id.txt" ]; then
        warn "No previous job ID found, skipping M3U export test"
        return 1
    fi
    
    JOB_ID=$(cat "$RESULTS_DIR/last_job_id.txt")
    
    response=$(curl -s -w "\n%{http_code}" \
        -H "Accept: application/vnd.apple.mpegurl" \
        "$BASE_URL/results/$JOB_ID?format=m3u")
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -eq 200 ]; then
        success "Results exported as M3U (HTTP $http_code)"
        echo "$body" > "$RESULTS_DIR/results_${JOB_ID}.m3u"
        success "M3U file saved to: results_${JOB_ID}.m3u"
        return 0
    elif [ "$http_code" -eq 202 ]; then
        warn "Job still processing (HTTP 202), M3U not yet available"
        return 0
    else
        fail "M3U export failed (HTTP $http_code)"
        return 1
    fi
}

# Test 6: Export as CSV
test_results_csv() {
    divider
    log "TEST 6: Export Results - CSV Format"
    divider
    
    if [ ! -f "$RESULTS_DIR/last_job_id.txt" ]; then
        warn "No previous job ID found, skipping CSV export test"
        return 1
    fi
    
    JOB_ID=$(cat "$RESULTS_DIR/last_job_id.txt")
    
    response=$(curl -s -w "\n%{http_code}" \
        -H "Accept: text/csv" \
        "$BASE_URL/results/$JOB_ID?format=csv")
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -eq 200 ]; then
        success "Results exported as CSV (HTTP $http_code)"
        echo "$body" > "$RESULTS_DIR/results_${JOB_ID}.csv"
        success "CSV file saved to: results_${JOB_ID}.csv"
        return 0
    elif [ "$http_code" -eq 202 ]; then
        warn "Job still processing (HTTP 202), CSV not yet available"
        return 0
    else
        fail "CSV export failed (HTTP $http_code)"
        return 1
    fi
}

# Test 7: Batch Processing
test_batch() {
    divider
    log "TEST 7: Batch Processing (3 URLs)"
    divider
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/batch" \
        -H "Content-Type: application/json" \
        -d '{
            "urls": [
                "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u",
                "https://gitlab.com/free-iptv/list/-/raw/main/iptv.m3u",
                "https://bitbucket.org/streamz/public/raw/main/channels.m3u8"
            ],
            "kodi_session_id": "batch-test-'$TIMESTAMP'",
            "kodi_source": "Batch Test"
        }')
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -eq 202 ]; then
        success "Batch jobs submitted (HTTP $http_code)"
        batch_size=$(echo "$body" | jq -r '.batch_size')
        success "Batch size: $batch_size URLs"
        
        # Save session ID for later tests
        SESSION_ID=$(echo "$body" | jq -r '.session_id')
        echo "$SESSION_ID" > "$RESULTS_DIR/last_session_id.txt"
        
        echo "$body" | jq . >> "$TEST_LOG"
        return 0
    else
        fail "Batch submission failed (HTTP $http_code)"
        echo "$body" >> "$TEST_LOG"
        return 1
    fi
}

# Test 8: Session Jobs
test_session() {
    divider
    log "TEST 8: Get Session Jobs"
    divider
    
    if [ ! -f "$RESULTS_DIR/last_session_id.txt" ]; then
        warn "No previous session ID found, skipping session test"
        return 1
    fi
    
    SESSION_ID=$(cat "$RESULTS_DIR/last_session_id.txt")
    log "Fetching jobs for session: $SESSION_ID"
    
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/session/$SESSION_ID")
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -eq 200 ]; then
        success "Session jobs retrieved (HTTP $http_code)"
        job_count=$(echo "$body" | jq -r '.total')
        success "Total jobs in session: $job_count"
        echo "$body" | jq . >> "$TEST_LOG"
        return 0
    else
        fail "Session retrieval failed (HTTP $http_code)"
        echo "$body" >> "$TEST_LOG"
        return 1
    fi
}

# Test 9: Error Handling - Missing URL
test_error_missing_url() {
    divider
    log "TEST 9: Error Handling - Missing URL"
    divider
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/receive" \
        -H "Content-Type: application/json" \
        -d '{"kodi_session_id": "error-test"}')
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -eq 400 ]; then
        error_code=$(echo "$body" | jq -r '.code')
        if [ "$error_code" == "MISSING_URL" ]; then
            success "Missing URL error correctly returned (HTTP 400)"
            echo "$body" | jq . >> "$TEST_LOG"
            return 0
        fi
    fi
    
    fail "Expected 400 with MISSING_URL, got HTTP $http_code"
    echo "$body" >> "$TEST_LOG"
    return 1
}

# Test 10: Error Handling - Invalid URL
test_error_invalid_url() {
    divider
    log "TEST 10: Error Handling - Invalid URL"
    divider
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/receive" \
        -H "Content-Type: application/json" \
        -d '{"source_url": "not-a-valid-url"}')
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -eq 400 ]; then
        error_code=$(echo "$body" | jq -r '.code')
        if [ "$error_code" == "INVALID_URL" ]; then
            success "Invalid URL error correctly returned (HTTP 400)"
            echo "$body" | jq . >> "$TEST_LOG"
            return 0
        fi
    fi
    
    fail "Expected 400 with INVALID_URL, got HTTP $http_code"
    echo "$body" >> "$TEST_LOG"
    return 1
}

# Test 11: Error Handling - Job Not Found
test_error_job_not_found() {
    divider
    log "TEST 11: Error Handling - Job Not Found"
    divider
    
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/status/invalid-job-id-12345")
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -eq 404 ]; then
        error_code=$(echo "$body" | jq -r '.code')
        if [ "$error_code" == "JOB_NOT_FOUND" ]; then
            success "Job not found error correctly returned (HTTP 404)"
            echo "$body" | jq . >> "$TEST_LOG"
            return 0
        fi
    fi
    
    fail "Expected 404 with JOB_NOT_FOUND, got HTTP $http_code"
    echo "$body" >> "$TEST_LOG"
    return 1
}

# Run all tests
run_all_tests() {
    divider
    log "KODI SYNC ENDPOINT - TEST SUITE"
    log "Started: $(date)"
    log "Results directory: $RESULTS_DIR"
    divider
    
    check_server
    
    PASSED=0
    FAILED=0
    
    # Run tests
    tests=(
        "test_health"
        "test_single_url"
        "test_job_status"
        "test_results_json"
        "test_results_m3u"
        "test_results_csv"
        "test_batch"
        "test_session"
        "test_error_missing_url"
        "test_error_invalid_url"
        "test_error_job_not_found"
    )
    
    for test in "${tests[@]}"; do
        if $test; then
            ((PASSED++))
        else
            ((FAILED++))
        fi
    done
    
    # Summary
    divider
    log "TEST SUMMARY"
    divider
    success "Passed: $PASSED"
    if [ $FAILED -gt 0 ]; then
        fail "Failed: $FAILED"
    fi
    
    total=$((PASSED + FAILED))
    log "Total: $total / $PASSED passed"
    log "Completed: $(date)"
    log "Log saved to: $TEST_LOG"
    
    divider
}

# Run specific test
run_specific_test() {
    test_name=$1
    check_server
    
    if declare -f "$test_name" > /dev/null; then
        log "Running test: $test_name"
        divider
        if $test_name; then
            success "$test_name completed"
        else
            fail "$test_name failed"
        fi
        divider
    else
        fail "Test not found: $test_name"
        echo "Available tests:"
        echo "  test_health"
        echo "  test_single_url"
        echo "  test_job_status"
        echo "  test_results_json"
        echo "  test_results_m3u"
        echo "  test_results_csv"
        echo "  test_batch"
        echo "  test_session"
        echo "  test_error_missing_url"
        echo "  test_error_invalid_url"
        echo "  test_error_job_not_found"
    fi
}

# Show results
show_results() {
    if [ -d "$RESULTS_DIR" ]; then
        log "Test Results Files"
        ls -lh "$RESULTS_DIR"/
    else
        warn "No results directory found"
    fi
}

# Cleanup
cleanup() {
    log "Cleaning up test files..."
    if [ -d "$RESULTS_DIR" ]; then
        rm -rf "$RESULTS_DIR"
        success "Cleaned up: $RESULTS_DIR"
    fi
}

# Main
case "${1:-all}" in
    all)
        run_all_tests
        ;;
    test_health|test_single_url|test_job_status|test_results_json|\
    test_results_m3u|test_results_csv|test_batch|test_session|\
    test_error_missing_url|test_error_invalid_url|test_error_job_not_found)
        run_specific_test "$1"
        ;;
    results)
        show_results
        ;;
    cleanup)
        cleanup
        ;;
    *)
        echo "Usage: $0 [all|test_name|results|cleanup]"
        echo ""
        echo "Run all tests:"
        echo "  $0 all"
        echo ""
        echo "Run single test:"
        echo "  $0 test_health"
        echo "  $0 test_single_url"
        echo "  $0 test_batch"
        echo ""
        echo "Show test results:"
        echo "  $0 results"
        echo ""
        echo "Clean up test files:"
        echo "  $0 cleanup"
        exit 1
        ;;
esac
