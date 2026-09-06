# Reviewed DSH source overlay

`source.lock.json` identifies the public upstream tag and immutable commit.
The patch includes the original rc.1 port plus input-preparation changes and
their tests, including the newly added preparation test. It contains no build
output or local installation state. DSH's MIT copyright is retained here.

Run the repository build script with an explicit disposable `--work-dir`.
It exports only the locked Git tree (ignoring the supplied checkout's working
files), applies the patch, installs the frozen upstream dependencies and runs
the upstream host/client/web build. Package output remains outside Git.
An optional `--upstream-source` can identify a local Git checkout containing
the exact tag; it is a source input, never a production runtime.

Core package versions intentionally differ: session and session-controller
retain the rc.1 port version, while LLM, AgentLoop and the locally extended
standard preset use the input-preparation release. Global default remains
standard; the work-state extension is not part of the standard composition.
