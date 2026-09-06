window.__ModuleLoader__.load({
	id: "dsh-llm-grok-oauth",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const jsx = require("react/jsx-runtime");
		const react = require("react");
		const reactDom = require("react-dom");

		const css = [
			".gkx_mount{border-top:1px solid var(--dsw-alias-border-l2);margin-top:4px;padding-top:12px;display:flex;flex-direction:column;gap:10px}",
			".gkx_summary{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px;line-height:1.5}",
			".gkx_manage{box-sizing:border-box;height:28px;appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:transparent;border-radius:14px;padding:0 10px;font-size:12px;line-height:18px}",
			".gkx_manage:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}",
			".gkx_manage:disabled{opacity:.4;cursor:default}",
			".gkx_panel{display:flex;flex-direction:column;gap:16px}",
			".gkx_section{display:flex;flex-direction:column;gap:8px}",
			".gkx_section+.gkx_section{border-top:1px solid var(--dsw-alias-border-l2);padding-top:14px}",
			".gkx_section_title{color:var(--dsw-alias-label-primary);margin:0;font-size:13px;font-weight:600;line-height:20px}",
			".gkx_catalog{display:flex;flex-direction:column;gap:8px}",
			".gkx_model{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:7px}",
			".gkx_model_head{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px}",
			".gkx_model_name{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:20px}",
			".gkx_model_id{color:var(--dsw-alias-label-tertiary);font:12px/18px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}",
			".gkx_efforts{display:flex;flex-wrap:wrap;gap:6px}",
			".gkx_effort{border:1px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary);border-radius:10px;padding:1px 7px;font-size:11px;line-height:16px}",
			".gkx_effort_default{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}",
			".gkx_field{display:flex;align-items:center;flex-wrap:wrap;gap:8px}",
			".gkx_field label{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}",
			".gkx_input{box-sizing:border-box;width:104px;height:30px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 9px;font:13px/20px inherit}",
			".gkx_input:disabled{opacity:.6;cursor:default}",
			".gkx_sync_meta{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}",
			".gkx_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}",
			".gkx_msg{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px;line-height:1.5}",
			".gkx_err{color:var(--dsw-alias-label-error);margin:0;font-size:13px;line-height:1.5}",
			".gkx_code{font:inherit;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.08em;font-size:18px;font-weight:600;color:var(--dsw-alias-label-primary)}",
			".gkx_row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
			".gkx_primary,.gkx_ghost{appearance:none;font:inherit;cursor:pointer;border-radius:8px;padding:6px 14px;font-size:13px;line-height:1.5}",
			".gkx_primary{border:1px solid transparent;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}",
			".gkx_ghost{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}",
			".gkx_primary:disabled,.gkx_ghost:disabled{opacity:.4;cursor:default}",
			".gkx_link{color:var(--dsw-alias-brand-primary);font-size:13px}",
		].join("");
		const tagId = "dsh-llm-grok-oauth/models.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-llm-grok-oauth";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		const NS = "settings.plugin.grokOAuth";
		const SETTINGS_NS = "llm-grok-oauth";
		const PROVIDER = "grok-oauth";
		const BACKGROUND_SYNC_SECONDS = 3600;
		const MIN_REFRESH_SECONDS = 10;
		const MAX_REFRESH_SECONDS = 86400;
		const MODEL_ID = /^grok-[a-z0-9][a-z0-9._-]*$/;
		const EFFORT_ID = /^[a-z0-9][a-z0-9._-]*$/;
		const CATALOG_CODES = new Set([
			"not_requested", "no_token", "token_error", "transport_error",
			"http_error", "parse_error", "empty_entitlement", "ok",
		]);
		const ROW_MARKERS = ["SuperGrok（DSH OAuth）", "SUPERGROK OAUTH"];

		const en = {
			login: "Sign in with Grok",
			loginPending: "Signing in…",
			logout: "Sign out",
			cancel: "Cancel sign-in",
			hint: "Creates a dedicated DSH device login. It never reads the official Grok CLI session.",
			opening: "Open the trusted xAI page below and complete sign-in.",
			userCode: "Confirmation code",
			openUrl: "Open sign-in page",
			missingCard: "Cannot find the SuperGrok card (provider grok-oauth / settingsNs llm-grok-oauth).",
			manage: "Manage",
			collapse: "Collapse",
			account: "Account",
			signedIn: "Grok account signed in",
			signedOut: "Grok account signed out",
			catalog: "Subscription models and reasoning levels",
			catalogLoading: "Loading the live subscription catalog…",
			catalogEmpty: "The live subscription catalog contains no selectable SuperGrok models.",
			catalogFailed: "The live SuperGrok catalog is unavailable. No cached or static model list is shown.",
			retry: "Retry",
			noReasoning: "No configurable reasoning level",
			defaultEffort: "default",
			sync: "Automatic synchronization",
			onDemandSync: "Selector refresh cache",
			backgroundSync: "Background refresh",
			seconds: "seconds",
			save: "Save",
			saving: "Saving…",
			saved: "Saved",
			refreshInvalid: "Enter a whole number from 10 to 86400.",
			refreshReadOnly: "This deployment does not allow settings changes.",
			refreshFailed: "Could not save the synchronization interval.",
			catalogStatus: "Catalog status",
			catalogObserved: "Last checked",
			loginFailed: "Sign-in failed. Please try again.",
			logoutFailed: "Sign-out failed. Please try again.",
			cancelFailed: "Could not cancel sign-in. Please try again.",
		};
		const zh = {
			login: "使用 Grok 账号登录",
			loginPending: "正在登录…",
			logout: "退出登录",
			cancel: "取消登录",
			hint: "将创建仅供 DSH 使用的设备登录；不会读取官方 Grok CLI 登录态。",
			opening: "请手动打开下方受信任的 xAI 授权页完成登录。",
			userCode: "确认代码",
			openUrl: "打开登录页",
			missingCard: "找不到 SuperGrok 卡片（provider grok-oauth / settingsNs llm-grok-oauth）。",
			manage: "管理",
			collapse: "收起",
			account: "账号管理",
			signedIn: "Grok 账号已登录",
			signedOut: "Grok 账号未登录",
			catalog: "订阅模型与推理等级",
			catalogLoading: "正在读取实时订阅目录…",
			catalogEmpty: "实时订阅目录中没有可选择的 SuperGrok 模型。",
			catalogFailed: "实时 SuperGrok 目录当前不可用；不会显示缓存或静态模型列表。",
			retry: "重试",
			noReasoning: "无可配置推理等级",
			defaultEffort: "默认",
			sync: "自动同步",
			onDemandSync: "选择器刷新缓存",
			backgroundSync: "后台刷新",
			seconds: "秒",
			save: "保存",
			saving: "保存中…",
			saved: "已保存",
			refreshInvalid: "请输入 10 到 86400 之间的整数。",
			refreshReadOnly: "当前部署不允许修改设置。",
			refreshFailed: "无法保存同步间隔。",
			catalogStatus: "目录状态",
			catalogObserved: "最近检查",
			loginFailed: "登录失败，请重试。",
			logoutFailed: "退出登录失败，请重试。",
			cancelFailed: "取消登录失败，请重试。",
		};

		function safeVerificationUrl(raw) {
			try {
				const url = new URL(raw);
				if (url.protocol !== "https:" || url.username || url.password || url.hash) return "";
				if (url.origin !== "https://auth.x.ai" && url.origin !== "https://accounts.x.ai") return "";
				return url.toString();
			} catch {
				return "";
			}
		}

		function createStore(initial) {
			let value = initial;
			const listeners = new Set();
			return {
				getSnapshot: () => value,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
				set: (next) => {
					value = next;
					for (const listener of listeners) listener();
				},
			};
		}

		function closestRow(node) {
			return node.closest("li") || node.closest("[class*='rowCard']") || node.closest("[class*='setupCard']");
		}

		function fixedError(code) {
			const error = new Error(code);
			error.code = code;
			return error;
		}

		function acceptLocalJsonResponse(response, body, code) {
			if (response?.ok !== true || !body || typeof body !== "object" || Array.isArray(body)) {
				throw fixedError(code);
			}
			return body;
		}

		function safeDisplayText(value, maxLength) {
			if (typeof value !== "string" || value.length === 0 || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
				throw fixedError("directory_invalid");
			}
			return value;
		}

		function normalizeDirectoryResponse(response) {
			if (!response || response.ok !== true || !Array.isArray(response.value?.groups)) {
				throw fixedError("directory_unavailable");
			}
			const matching = response.value.groups.filter((group) => group?.id === PROVIDER);
			if (matching.length !== 1 || !Array.isArray(matching[0].models) || matching[0].models.length > 256) {
				throw fixedError(matching.length === 0 ? "directory_unavailable" : "directory_invalid");
			}
			const seenModels = new Set();
			return matching[0].models.map((model) => {
				if (!model || typeof model !== "object" || typeof model.id !== "string"
					|| model.id.length > 128 || !MODEL_ID.test(model.id) || seenModels.has(model.id)) {
					throw fixedError("directory_invalid");
				}
				seenModels.add(model.id);
				const name = safeDisplayText(model.name, 256);
				if (model.reasoning === undefined) return Object.freeze({ id: model.id, name, efforts: Object.freeze([]) });
				const efforts = model.reasoning?.efforts;
				if (!Array.isArray(efforts) || efforts.length === 0 || efforts.length > 16) throw fixedError("directory_invalid");
				const seenEfforts = new Set();
				const normalizedEfforts = efforts.map((effort) => {
					if (!effort || typeof effort !== "object" || typeof effort.id !== "string"
						|| effort.id.length > 32 || !EFFORT_ID.test(effort.id) || seenEfforts.has(effort.id)) {
						throw fixedError("directory_invalid");
					}
					seenEfforts.add(effort.id);
					return Object.freeze({ id: effort.id, name: safeDisplayText(effort.name, 256) });
				});
				const defaultEffort = model.reasoning.defaultEffort;
				if (defaultEffort !== undefined && !seenEfforts.has(defaultEffort)) throw fixedError("directory_invalid");
				return Object.freeze({
					id: model.id,
					name,
					efforts: Object.freeze(normalizedEfforts),
					...(defaultEffort === undefined ? {} : { defaultEffort }),
				});
			});
		}

		function normalizeCatalogStatus(response) {
			const catalog = response?.ok === true ? response.catalog : undefined;
			if (!catalog || !CATALOG_CODES.has(catalog.code) || !Number.isSafeInteger(catalog.observedAt) || catalog.observedAt < 0) {
				throw fixedError("catalog_status_unavailable");
			}
			const acceptedCount = catalog.acceptedCount;
			if (acceptedCount !== undefined && (!Number.isSafeInteger(acceptedCount) || acceptedCount < 0 || acceptedCount > 256)) {
				throw fixedError("catalog_status_invalid");
			}
			return Object.freeze({
				code: catalog.code,
				observedAt: catalog.observedAt,
				...(acceptedCount === undefined ? {} : { acceptedCount }),
			});
		}

		function parseRefreshSeconds(value) {
			const text = String(value ?? "").trim();
			if (!/^\d+$/.test(text)) return undefined;
			const parsed = Number(text);
			if (!Number.isSafeInteger(parsed) || parsed < MIN_REFRESH_SECONDS || parsed > MAX_REFRESH_SECONDS) return undefined;
			return parsed;
		}

		async function writeModelsRefreshSeconds(scope, rawValue) {
			const value = parseRefreshSeconds(rawValue);
			if (value === undefined) return Object.freeze({ ok: false, code: "invalid" });
			const snapshot = scope.getSnapshot();
			if (snapshot.status !== "ready" || snapshot.writable !== true || !Number.isSafeInteger(snapshot.revision)) {
				return Object.freeze({ ok: false, code: "read_only" });
			}
			try {
				await scope.set("modelsRefreshSeconds", value);
			} catch {
				return Object.freeze({ ok: false, code: "failed" });
			}
			const settled = scope.getSnapshot();
			if (settled.status !== "ready" || settled.value?.modelsRefreshSeconds !== value) {
				return Object.freeze({ ok: false, code: settled.writable !== true ? "read_only" : "failed" });
			}
			return Object.freeze({ ok: true, value });
		}

		function createDirectoryLoader(options) {
			let generation = 0;
			let inFlight;
			let rerun = false;
			let disposed = false;

			const load = () => {
				if (disposed) return Promise.resolve(undefined);
				const requestedGeneration = ++generation;
				if (inFlight !== undefined) {
					rerun = true;
					return inFlight;
				}
				let task;
				task = (async () => {
					let activeGeneration = requestedGeneration;
					for (;;) {
						if (disposed) return;
						rerun = false;
						options.loading();
						try {
							const value = await options.read();
							if (!disposed && activeGeneration === generation) options.ready(value);
						} catch {
							if (!disposed && activeGeneration === generation) options.error();
						}
						if (disposed || !rerun) return;
						activeGeneration = generation;
					}
				})().finally(() => {
					if (inFlight === task) inFlight = undefined;
				});
				inFlight = task;
				return task;
			};

			return Object.freeze({
				load,
				reset: () => {
					if (disposed) return;
					++generation;
					rerun = false;
					options.reset();
				},
				dispose: () => {
					disposed = true;
					++generation;
					rerun = false;
				},
			});
		}

		function stockEditLabelMatches(ariaLabel, text) {
			const providerTail = new RegExp("\\(" + PROVIDER + "\\)\\s*$");
			const copy = String(text ?? "").trim().toLowerCase();
			const label = String(ariaLabel ?? "").trim().toLowerCase();
			return (copy === "edit" || copy === "编辑")
				&& label.startsWith(copy + " ")
				&& providerTail.test(label);
		}

		function isOwnSettingsDocument(namespace) {
			return namespace === SETTINGS_NS;
		}

		function findStockEdit(row) {
			for (const button of row.querySelectorAll("button[aria-label]")) {
				if (stockEditLabelMatches(button.getAttribute("aria-label"), button.textContent)) return button;
			}
			return null;
		}

		function findGrokRow() {
			const marked = document.querySelector("[data-gkx-ns='" + SETTINGS_NS + "']");
			if (marked) return { row: closestRow(marked) || marked, via: "data-ns" };

			const labeled = document.querySelectorAll("button[aria-label]");
			for (const button of labeled) {
				if (!stockEditLabelMatches(button.getAttribute("aria-label"), button.textContent)) continue;
				const row = closestRow(button);
				if (row) return { row, via: "aria-provider" };
			}

			const nsNodes = document.querySelectorAll("p, code, pre, span, label");
			for (const node of nsNodes) {
				const text = (node.textContent || "").trim();
				if (text !== SETTINGS_NS && !text.startsWith(SETTINGS_NS + ":") && !text.includes(" " + SETTINGS_NS)) continue;
				const row = closestRow(node);
				if (row) return { row, via: "settings-ns" };
			}

			const buttons = document.querySelectorAll("button");
			for (const button of buttons) {
				const label = `${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`;
				if (!ROW_MARKERS.some((marker) => label.includes(marker))) continue;
				const row = closestRow(button);
				if (row) return { row, via: "display-name" };
			}
			return { row: null, via: "miss" };
		}

		function hideUnknownHostEditor(row, hiddenEditors) {
			for (const node of row.querySelectorAll("p")) {
				const text = node.textContent || "";
				if (!text.includes("settings.yaml") && !text.includes("llm-grok")) continue;
				let block = node.parentElement;
				while (block && block !== row && block.tagName !== "LI") {
					if (block.querySelector("button")) {
						if (!hiddenEditors.has(block)) hiddenEditors.set(block, block.style.display);
						block.style.display = "none";
						block.setAttribute("data-gkx-stock-editor-hidden", "true");
						break;
					}
					block = block.parentElement;
				}
			}
		}

		function ManageButton(props) {
			const state = props.useGrokCard((snapshot) => snapshot);
			return jsx.jsx("button", {
				type: "button",
				className: "gkx_manage",
				"aria-expanded": state.managementOpen,
				"aria-controls": "gkx-supergrok-management",
				onClick: props.toggleManagement,
				children: state.managementOpen ? props.t("collapse") : props.t("manage"),
			});
		}

		function AccountSection(props) {
			const { t } = props;
			const state = props.useGrokCard((snapshot) => snapshot);
			const verificationUrl = safeVerificationUrl(state.verificationUrl);

			const signedIn = state.oauthStatus === "signed-in";
			const pending = state.oauthStatus === "pending";
			const message = state.actionError ? t(state.actionError) : state.oauthMessage;
			return jsx.jsxs("section", {
				className: "gkx_section",
				children: [
					jsx.jsx("h3", { className: "gkx_section_title", children: t("account") }),
					message
						? jsx.jsx("p", {
							className: state.actionError || state.oauthStatus === "error" ? "gkx_err" : "gkx_msg",
							children: message,
						})
						: (!signedIn && !pending ? jsx.jsx("p", { className: "gkx_hint", children: t("hint") }) : null),
					pending && state.userCode
						? jsx.jsxs("p", {
							className: "gkx_msg",
							children: [t("userCode"), ": ", jsx.jsx("span", { className: "gkx_code", children: state.userCode })],
						})
						: null,
					pending && verificationUrl ? jsx.jsx("p", { className: "gkx_hint", children: t("opening") }) : null,
					pending && verificationUrl
						? jsx.jsx("a", {
							className: "gkx_link",
							href: verificationUrl,
							target: "_blank",
							rel: "noopener noreferrer",
							onClick: (event) => {
								event.preventDefault();
								window.open(verificationUrl, "_blank", "noopener,noreferrer");
							},
							children: t("openUrl"),
						})
						: null,
					jsx.jsxs("div", {
						className: "gkx_row",
						children: [
							jsx.jsx("button", {
								type: "button",
								className: "gkx_primary",
								disabled: pending,
								onClick: () => { props.login(); },
								children: pending ? t("loginPending") : t("login"),
							}),
							pending ? jsx.jsx("button", {
								type: "button",
								className: "gkx_ghost",
								onClick: () => { props.cancel(); },
								children: t("cancel"),
							}) : null,
							signedIn ? jsx.jsx("button", {
								type: "button",
								className: "gkx_ghost",
								disabled: pending,
								onClick: () => { props.logout(); },
								children: t("logout"),
							}) : null,
						],
					}),
				],
			});
		}

		function CatalogSection(props) {
			const { t } = props;
			const state = props.useGrokCard((snapshot) => snapshot);
			let body;
			if (state.directoryStatus === "loading" || state.directoryStatus === "idle") {
				body = jsx.jsx("p", { className: "gkx_hint", children: t("catalogLoading") });
			} else if (state.directoryStatus === "error") {
				body = jsx.jsxs("div", {
					className: "gkx_catalog",
					children: [
						jsx.jsx("p", { className: "gkx_err", children: t("catalogFailed") }),
						jsx.jsx("button", { type: "button", className: "gkx_ghost", onClick: props.loadDirectory, children: t("retry") }),
					],
				});
			} else if (state.directoryModels.length === 0) {
				body = jsx.jsx("p", { className: "gkx_hint", children: t("catalogEmpty") });
			} else {
				body = jsx.jsx("div", {
					className: "gkx_catalog",
					children: state.directoryModels.map((model) => jsx.jsxs("div", {
						className: "gkx_model",
						children: [
							jsx.jsxs("div", {
								className: "gkx_model_head",
								children: [
									jsx.jsx("span", { className: "gkx_model_name", children: model.name }),
									model.name === model.id ? null : jsx.jsx("span", { className: "gkx_model_id", children: model.id }),
								],
							}),
							model.efforts.length === 0
								? jsx.jsx("span", { className: "gkx_hint", children: t("noReasoning") })
								: jsx.jsx("div", {
									className: "gkx_efforts",
									children: model.efforts.map((effort) => jsx.jsxs("span", {
										className: "gkx_effort" + (model.defaultEffort === effort.id ? " gkx_effort_default" : ""),
										children: [effort.name, model.defaultEffort === effort.id ? ` · ${t("defaultEffort")}` : ""],
									}, effort.id)),
								}),
						],
					}, model.id)),
				});
			}
			return jsx.jsxs("section", {
				className: "gkx_section",
				children: [
					jsx.jsx("h3", { className: "gkx_section_title", children: t("catalog") }),
					body,
				],
			});
		}

		function SyncSection(props) {
			const { t } = props;
			const state = props.useGrokCard((snapshot) => snapshot);
			const [draft, setDraft] = react.useState(String(state.modelsRefreshSeconds));
			const [dirty, setDirty] = react.useState(false);
			react.useEffect(() => {
				if (!dirty) setDraft(String(state.modelsRefreshSeconds));
			}, [state.modelsRefreshSeconds, dirty]);
			const parsed = parseRefreshSeconds(draft);
			const save = async (event) => {
				event.preventDefault();
				if (parsed === undefined || state.saving || !state.writable) return;
				const ok = await props.saveRefresh(draft);
				if (ok) setDirty(false);
			};
			let saveMessage = "";
			if (state.saveStatus === "saved") saveMessage = t("saved");
			else if (state.saveStatus === "invalid") saveMessage = t("refreshInvalid");
			else if (state.saveStatus === "read_only") saveMessage = t("refreshReadOnly");
			else if (state.saveStatus === "failed" || state.saveStatus === "conflict") saveMessage = t("refreshFailed");
			const observed = state.catalogStatus?.observedAt === undefined
				? ""
				: new Date(state.catalogStatus.observedAt).toLocaleString();
			return jsx.jsxs("section", {
				className: "gkx_section",
				children: [
					jsx.jsx("h3", { className: "gkx_section_title", children: t("sync") }),
					jsx.jsxs("form", {
						className: "gkx_field",
						onSubmit: save,
						children: [
							jsx.jsx("label", { htmlFor: "gkx-refresh-seconds", children: t("onDemandSync") }),
							jsx.jsx("input", {
								id: "gkx-refresh-seconds",
								className: "gkx_input",
								type: "number",
								min: MIN_REFRESH_SECONDS,
								max: MAX_REFRESH_SECONDS,
								step: 1,
								value: draft,
								disabled: state.saving || !state.writable,
								onChange: (event) => {
									setDraft(event.target.value);
									setDirty(true);
								},
							}),
							jsx.jsx("span", { className: "gkx_hint", children: t("seconds") }),
							jsx.jsx("button", {
								type: "submit",
								className: "gkx_ghost",
								disabled: parsed === undefined || state.saving || !state.writable || (!dirty && parsed === state.modelsRefreshSeconds),
								children: state.saving ? t("saving") : t("save"),
							}),
						],
					}),
					saveMessage ? jsx.jsx("p", { className: state.saveStatus === "saved" ? "gkx_msg" : "gkx_err", children: saveMessage }) : null,
					jsx.jsxs("p", {
						className: "gkx_sync_meta",
						children: [t("backgroundSync"), ": ", String(BACKGROUND_SYNC_SECONDS), " ", t("seconds")],
					}),
					state.catalogStatus === undefined ? null : jsx.jsxs("p", {
						className: "gkx_sync_meta",
						children: [
							t("catalogStatus"), ": ", state.catalogStatus.code,
							state.catalogStatus.acceptedCount === undefined ? "" : ` · ${state.catalogStatus.acceptedCount}`,
							observed ? ` · ${t("catalogObserved")}: ${observed}` : "",
						],
					}),
				],
			});
		}

		function UsageDashboard({ signedIn }) {
			const [data, setData] = react.useState(null);
			const [loading, setLoading] = react.useState(false);
			const [now, setNow] = react.useState(Date.now());
			const refreshRef = react.useRef(() => {});
			react.useEffect(() => {
				setData(null);
				if (!signedIn) { setLoading(false); return; }
				let active = true, pending = false, attempted = 0;
				const controller = new AbortController();
				const refresh = async (force = false) => {
					if (!active || pending || document.visibilityState === 'hidden' || Date.now()-attempted < 5000) return;
					pending = true; attempted = Date.now(); setLoading(true);
					try {
						const response = await fetch('/api/llm-grok-oauth/usage', { credentials:'same-origin', cache:'no-store', signal:controller.signal,
							headers: force ? {'x-dsh-usage-refresh':'1'} : {} });
						const body = await response.json();
						if (!response.ok || !body.ok || !body.usage) throw new Error('usage unavailable');
						if (active) setData(body.usage);
					} catch { if(active) setData(previous => ({status:previous?.snapshot?'stale':'unavailable', snapshot:previous?.snapshot ?? null})); }
					finally {pending=false; if(active)setLoading(false);}
				};
				refreshRef.current=refresh;
				void refresh();
				const visible=()=>{if(document.visibilityState!=='hidden')void refresh();};
				document.addEventListener('visibilitychange',visible);
				const poll=setInterval(()=>void refresh(),60000);
				const clock=setInterval(()=>{if(document.visibilityState!=='hidden')setNow(Date.now());},1000);
				return ()=>{active=false;controller.abort();clearInterval(poll);clearInterval(clock);document.removeEventListener('visibilitychange',visible);refreshRef.current=()=>{};};
			},[signedIn]);
			const snapshot=data?.snapshot;
			const reset= snapshot?.resetAt ? Date.parse(snapshot.resetAt) : NaN;
			const resetRef=react.useRef(null);
			react.useEffect(()=>{if(Number.isFinite(reset)&&reset<=now&&resetRef.current!==reset){resetRef.current=reset;void refreshRef.current(true);}},[reset,now]);
			const remainingMs=reset-now;
			const mins=Math.max(0,Math.ceil(remainingMs/60000));
			const countdown=mins>=1440?`${Math.floor(mins/1440)} 天 ${Math.floor(mins%1440/60)} 小时`:mins>=60?`${Math.floor(mins/60)} 小时 ${mins%60} 分钟`:`${mins} 分钟`;
			const pct=(n)=>typeof n==='number'?`${n.toFixed(1)}%`:'暂未提供';
			const local=(value)=>new Date(value).toLocaleString(undefined,{timeZoneName:'short'});
			return jsx.jsxs('section',{className:'gkx_section',style:{marginTop:16,borderTop:'1px solid #8884',paddingTop:12,minWidth:0},children:[
				jsx.jsxs('div',{style:{display:'flex',gap:12,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'},children:[
					jsx.jsx('h3',{className:'gkx_section_title',children:'账户订阅额度'}),
					jsx.jsx('button',{type:'button',className:'gkx_ghost',disabled:loading||!signedIn,onClick:()=>void refreshRef.current(true),children:loading?'刷新中…':'刷新'})]}),
				!signedIn ? jsx.jsx('p',{children:'登录 SuperGrok 后查看额度。'}) : jsx.jsxs(react.Fragment,{children:[
					!snapshot ? jsx.jsx('p',{role:'status',children:loading?'正在获取订阅额度…':'暂时无法获取订阅额度，请稍后刷新。'}) : jsx.jsxs(react.Fragment,{children:[
						jsx.jsx('p',{children:`${snapshot.period==='weekly'?'本周':snapshot.period==='monthly'?'本月':'当前周期'}已用 ${pct(snapshot.usedPercent)} · 剩余 ${pct(snapshot.remainingPercent)}`}),
						snapshot.usedPercent===null?null:jsx.jsx('progress',{max:100,value:Math.min(100,snapshot.usedPercent),'aria-label':'订阅额度已用百分比',style:{width:'100%',accentColor:snapshot.usedPercent>=90?'#e99543':'#67b7a4'}}),
						jsx.jsx('p',{style:{overflowWrap:'anywhere'},children: snapshot.resetAt?`下次重置：${local(snapshot.resetAt)}（${remainingMs>0?`还有 ${countdown}`:'已到重置时间，等待服务端更新'}）`:'下次重置：服务端暂未提供'}),
						jsx.jsx('p',{className:'gkx_hint',children:`最后更新：${local(snapshot.fetchedAt)}`}),
						data.status==='stale'?jsx.jsx('p',{role:'status',className:'gkx_err',children:'数据已过期，刷新失败；以上为上次成功结果。'}):null,
						!snapshot.complete?jsx.jsx('p',{className:'gkx_hint',children:'服务端尚未提供完整额度信息。'}):null,
					]}),
					jsx.jsx('p',{className:'gkx_hint',children:'账户额度可能包含其他客户端的消耗，不等同于本会话 token 用量。'})
				]})
			]});
		}

		function CardBody(props) {
			const state = props.useGrokCard((snapshot) => snapshot);
			const signedIn = state.oauthStatus === "signed-in";
			return jsx.jsxs("div", {
				className: "gkx_mount",
				children: [
					jsx.jsx("p", { className: "gkx_summary", children: props.t(signedIn ? "signedIn" : "signedOut") }),
					jsx.jsx(UsageDashboard, { signedIn }),
					state.managementOpen ? jsx.jsxs("div", {
						id: "gkx-supergrok-management",
						className: "gkx_panel",
						children: [
							jsx.jsx(AccountSection, props),
							jsx.jsx(CatalogSection, props),
							jsx.jsx(SyncSection, props),
						],
					}) : null,
				],
			});
		}

		function ModelsPortal(props) {
			const [targets, setTargets] = react.useState({ row: null, body: null, action: null });
			const [missed, setMissed] = react.useState(false);

			react.useEffect(() => {
				const hiddenButtons = new Map();
				const hiddenEditors = new Map();
				const createdMounts = new Set();
				const markedRows = new Set();
				const ensureMount = (host) => {
					if (!host) return { row: null, body: null, action: null };
					const stockEdit = findStockEdit(host);
					let action = host.querySelector(".gkx_action_host");
					const alreadyOwned = host.getAttribute("data-gkx-ns") === SETTINGS_NS && action !== null;
					if (stockEdit === null && !alreadyOwned) return { row: null, body: null, action: null };
					host.setAttribute("data-gkx-ns", SETTINGS_NS);
					markedRows.add(host);
					if (stockEdit !== null) {
						if (!hiddenButtons.has(stockEdit)) hiddenButtons.set(stockEdit, stockEdit.style.display);
						stockEdit.style.display = "none";
						stockEdit.setAttribute("data-gkx-stock-edit-hidden", "true");
						if (action === null) {
							action = document.createElement("span");
							action.className = "gkx_action_host";
							stockEdit.parentElement?.insertBefore(action, stockEdit);
							createdMounts.add(action);
						}
					}
					hideUnknownHostEditor(host, hiddenEditors);
					let body = host.querySelector(":scope > .gkx_mount_host");
					if (body === null) {
						body = document.createElement("div");
						body.className = "gkx_mount_host";
						host.appendChild(body);
						createdMounts.add(body);
					}
					return { row: host, body, action };
				};
				const scan = () => {
					const found = findGrokRow();
					const modelsPage = document.querySelector("[class*='rowCard'], [class*='setupCard']") !== null;
					setMissed(modelsPage && found.row === null);
					const next = ensureMount(found.row);
					setTargets((previous) => previous.row === next.row && previous.body === next.body && previous.action === next.action ? previous : next);
				};
				scan();
				const observer = new MutationObserver(scan);
				observer.observe(document.body, { childList: true, subtree: true });
				return () => {
					observer.disconnect();
					for (const [button, display] of hiddenButtons) {
						button.style.display = display;
						button.removeAttribute("data-gkx-stock-edit-hidden");
					}
					for (const [editor, display] of hiddenEditors) {
						editor.style.display = display;
						editor.removeAttribute("data-gkx-stock-editor-hidden");
					}
					for (const mount of createdMounts) mount.remove();
					for (const marked of markedRows) marked.removeAttribute("data-gkx-ns");
				};
			}, []);

			if (targets.row === null || targets.body === null || targets.action === null) {
				if (!missed) return null;
				return jsx.jsx("p", { className: "gkx_err", children: props.t ? props.t("missingCard") : "找不到 Grok 卡片" });
			}
			return jsx.jsxs(react.Fragment, {
				children: [
					reactDom.createPortal(jsx.jsx(ManageButton, props), targets.action),
					reactDom.createPortal(jsx.jsx(CardBody, props), targets.body),
				],
			});
		}

		const inject = ["slots", "locale", "remote", "remote.session", "settingsScope"];

		async function postAction(path, csrfToken) {
			if (!csrfToken) throw new Error("missing CSRF token");
			const response = await fetch(path, {
				method: "POST",
				credentials: "same-origin",
				cache: "no-store",
				referrerPolicy: "same-origin",
				headers: {
					"content-type": "application/json",
					"x-dsh-grok-csrf": csrfToken,
				},
				body: "{}",
			});
			let body;
			try { body = await response.json(); } catch { throw fixedError("oauth_action_failed"); }
			return acceptLocalJsonResponse(response, body, "oauth_action_failed");
		}

		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "ui-llm-grok-oauth: dictionaries");
			const scope = ctx.settingsScope.bind({ namespace: SETTINGS_NS });
			const store = createStore({
				...project(scope),
				managementOpen: false,
				directoryStatus: "idle",
				directoryModels: Object.freeze([]),
				catalogStatus: undefined,
				saving: false,
				saveStatus: "idle",
				actionError: "",
			});
			let lifecycleDisposed = false;
			let catalogGeneration = 0;
			let holdSignedOutUntil = 0;
			const unsubscribeScope = scope.subscribe(() => {
				if (lifecycleDisposed) return;
				const next = project(scope);
				const cur = store.getSnapshot();
				if (Date.now() < holdSignedOutUntil && next.oauthStatus === "signed-in") return;
				if (cur.oauthStatus === "pending" && next.oauthStatus === "signed-out" && !next.userCode && next.oauthMessage !== "已退出登录") {
					store.set({
						...cur,
						writable: next.writable,
						available: next.available,
						modelsRefreshSeconds: next.modelsRefreshSeconds,
					});
					return;
				}
				store.set({ ...cur, ...next });
			});

			const applyRemote = (body) => {
				if (lifecycleDisposed) return;
				if (!body || typeof body !== "object") return;
				const prev = store.getSnapshot();
				const oauthStatus = body.oauthStatus || prev.oauthStatus;
				if (Date.now() < holdSignedOutUntil && oauthStatus === "signed-in") return;
				store.set({
					...prev,
					actionError: "",
					oauthStatus,
					verificationUrl: body.verificationUrl || "",
					userCode: body.userCode || "",
					oauthMessage: body.oauthMessage || (oauthStatus === "signed-out" ? "已退出登录" : ""),
					csrfToken: typeof body.csrfToken === "string" ? body.csrfToken : prev.csrfToken,
				});
			};

			const fetchStatus = async () => {
				const response = await fetch("/api/llm-grok-oauth/status", {
					credentials: "same-origin",
					cache: "no-store",
					referrerPolicy: "same-origin",
				});
				let body;
				try { body = await response.json(); } catch { throw fixedError("oauth_status_unavailable"); }
				body = acceptLocalJsonResponse(response, body, "oauth_status_unavailable");
				if (!lifecycleDisposed) applyRemote(body);
				return body;
			};

			const fetchCatalogStatus = async () => {
				const generation = ++catalogGeneration;
				const response = await fetch("/api/llm-grok-oauth/catalog-status", {
					credentials: "same-origin",
					cache: "no-store",
					referrerPolicy: "same-origin",
				});
				if (!response.ok) throw fixedError("catalog_status_unavailable");
				let body;
				try { body = await response.json(); } catch { throw fixedError("catalog_status_unavailable"); }
				const catalogStatus = normalizeCatalogStatus(body);
				if (!lifecycleDisposed && generation === catalogGeneration) {
					store.set({ ...store.getSnapshot(), catalogStatus });
				}
				return catalogStatus;
			};

			const directoryLoader = createDirectoryLoader({
				read: async () => normalizeDirectoryResponse(await ctx.remote.session.modelCatalog()),
				loading: () => {
					if (lifecycleDisposed) return;
					store.set({ ...store.getSnapshot(), directoryStatus: "loading" });
				},
				ready: (models) => {
					if (lifecycleDisposed) return;
					store.set({
						...store.getSnapshot(),
						directoryStatus: "ready",
						directoryModels: Object.freeze(models),
					});
					void fetchCatalogStatus().catch(() => { /* safe diagnostics are optional */ });
				},
				error: () => {
					if (lifecycleDisposed) return;
					store.set({
						...store.getSnapshot(),
						directoryStatus: "error",
						directoryModels: Object.freeze([]),
					});
				},
				reset: () => {
					if (lifecycleDisposed) return;
					++catalogGeneration;
					store.set({
						...store.getSnapshot(),
						directoryStatus: "idle",
						directoryModels: Object.freeze([]),
						catalogStatus: undefined,
					});
				},
			});
			const loadDirectory = () => directoryLoader.load();

			const toggleManagement = () => {
				const current = store.getSnapshot();
				const managementOpen = !current.managementOpen;
				store.set({ ...current, managementOpen, saveStatus: "idle" });
				if (managementOpen) void loadDirectory();
				else directoryLoader.reset();
			};

			const saveRefresh = async (value) => {
				const current = store.getSnapshot();
				if (current.saving) return false;
				store.set({ ...current, saving: true, saveStatus: "idle" });
				const result = await writeModelsRefreshSeconds(scope, value);
				if (lifecycleDisposed) return false;
				const latest = store.getSnapshot();
				if (!result.ok) {
					store.set({ ...latest, saving: false, saveStatus: result.code });
					return false;
				}
				store.set({
					...latest,
					saving: false,
					saveStatus: "saved",
					modelsRefreshSeconds: result.value,
				});
				return true;
			};

			const action = async (path) => {
				let token = store.getSnapshot().csrfToken;
				if (!token) token = (await fetchStatus()).csrfToken;
				return postAction(path, token);
			};

			const login = async () => {
				holdSignedOutUntil = 0;
				store.set({
					...store.getSnapshot(),
					oauthStatus: "pending",
					oauthMessage: "正在发起登录…",
					actionError: "",
				});
				try {
					applyRemote(await action("/api/llm-grok-oauth/login"));
				} catch (error) {
					if (lifecycleDisposed) return;
					const current = store.getSnapshot();
					store.set({ ...current, oauthStatus: "error", oauthMessage: "", actionError: "loginFailed" });
				}
			};
			const logout = async () => {
				store.set({
					...store.getSnapshot(),
					oauthStatus: "pending",
					oauthMessage: "正在撤销并清除 DSH OAuth 凭据…",
					actionError: "",
				});
				try {
					applyRemote(await action("/api/llm-grok-oauth/logout"));
				} catch (error) {
					if (lifecycleDisposed) return;
					const current = store.getSnapshot();
					store.set({ ...current, oauthStatus: "error", oauthMessage: "", actionError: "logoutFailed" });
				}
			};
			const cancel = async () => {
				store.set({
					...store.getSnapshot(),
					oauthStatus: "error",
					oauthMessage: "已取消登录",
					actionError: "",
					verificationUrl: "",
					userCode: "",
				});
				try {
					applyRemote(await action("/api/llm-grok-oauth/cancel"));
				} catch (error) {
					if (lifecycleDisposed) return;
					const current = store.getSnapshot();
					store.set({ ...current, oauthStatus: "error", oauthMessage: "", actionError: "cancelFailed" });
				}
			};

			ctx.effect(() => {
				let stopped = false;
				const tick = async () => {
					if (stopped) return;
					try {
						await fetchStatus();
					} catch { /* host not ready */ }
				};
				tick();
				const timer = setInterval(tick, 1000);
				return () => {
					stopped = true;
					clearInterval(timer);
				};
			}, "ui-llm-grok-oauth: status poll");

			ctx.effect(() => {
				const refresh = () => {
					if (store.getSnapshot().managementOpen) void loadDirectory();
				};
				const refreshSettings = (namespace) => {
					if (isOwnSettingsDocument(namespace)) refresh();
				};
				const reset = () => {
					directoryLoader.reset();
					if (store.getSnapshot().managementOpen) void loadDirectory();
				};
				const disposers = [
					ctx.remote.$on("llm/adapters-updated", refresh),
					ctx.remote.$on("settings/document-updated", refreshSettings),
					ctx.on("connection/reset", reset),
				];
				return () => {
					lifecycleDisposed = true;
					++catalogGeneration;
					directoryLoader.dispose();
					if (typeof unsubscribeScope === "function") unsubscribeScope();
					for (const dispose of disposers) dispose();
				};
			}, "ui-llm-grok-oauth: live catalog invalidation");

			ctx.slots.inject("settings.action", () => ctx.slots.register({
				name: "settings.action",
				id: "llm-grok-oauth-models-login",
				order: 80,
				locale: NS,
				inject: () => ({
					hooks: { grokCard: store },
					login,
					logout,
					cancel,
					toggleManagement,
					loadDirectory,
					saveRefresh,
				}),
			}, ModelsPortal));
		}

		function project(scope) {
			const snapshot = scope.getSnapshot();
			const value = snapshot.value || {};
			return {
				available: snapshot.status === "ready",
				writable: snapshot.status === "ready" && snapshot.writable === true,
				modelsRefreshSeconds: parseRefreshSeconds(value.modelsRefreshSeconds) ?? 60,
				oauthStatus: value.oauthStatus || "signed-out",
				verificationUrl: value.verificationUrl || "",
				userCode: value.userCode || "",
				oauthMessage: value.oauthMessage || "",
			};
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.__test = Object.freeze({
			acceptLocalJsonResponse,
			createDirectoryLoader,
			isOwnSettingsDocument,
			normalizeCatalogStatus,
			normalizeDirectoryResponse,
			parseRefreshSeconds,
			stockEditLabelMatches,
			writeModelsRefreshSeconds,
		});
		return module.exports;
	},
});
