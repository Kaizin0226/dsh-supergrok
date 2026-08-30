# Windows deployment

The scripts are parameterized and default to dry-run. They never contain a machine-specific DSH path, candidate path, backup root, or local security baseline.

For the Grok optimized preset, pass `-CandidateRoot`, `-PresetParent`, and `-BackupRoot`. Add `-Apply` only after the dry-run output and exact resolved paths have been reviewed. Rollback additionally requires the exact install record path.

The xAI/DSH overlay rollout under `contracts/xai-dsh/scripts/rollout.ps1` requires `-DshRoot`, `-RollbackRoot`, and `-LocalManifest`. The real manifest is ignored by Git and must remain local; `manifest.example.json` documents its shape without production hashes.

No deployment script starts, stops, or restarts DSH. Process-state and live-model acceptance remain separate, explicitly authorized local operations.
