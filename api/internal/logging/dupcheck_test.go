package logging

import (
	"os"
	"os/exec"
	"strings"
	"testing"
)

// Emits one log line in a non-TTY subprocess and asserts the JSON has a
// single "time" key.
func TestNoDuplicateTimeKey(t *testing.T) {
	if os.Getenv("LOG_DUP_CHILD") == "1" {
		New("info").Info("sample", "provider", "x")
		return
	}
	cmd := exec.Command(os.Args[0], "-test.run", "TestNoDuplicateTimeKey")
	cmd.Env = append(os.Environ(), "LOG_DUP_CHILD=1")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("child failed: %v\n%s", err, out)
	}
	line := strings.SplitN(string(out), "\n", 2)[0]
	if n := strings.Count(line, `"time":`); n != 1 {
		t.Fatalf("want exactly one time key, got %d in %q", n, line)
	}
}
