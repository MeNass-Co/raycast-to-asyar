var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../../shim/node_modules/asyar-sdk/dist/ipc/devInspectorBridge.js
function isInspectorActive() {
  if (typeof window === "undefined")
    return false;
  return window.__ASYAR_DEV_INSPECTOR_ACTIVE__ === true;
}
function emitRpcLog(payload) {
  var _a;
  if (!((_a = import.meta.env) === null || _a === void 0 ? void 0 : _a.DEV))
    return;
  if (!isInspectorActive())
    return;
  postToParent("asyar:dev:rpc-log", payload);
}
function emitIpcLog(payload) {
  var _a;
  if (!((_a = import.meta.env) === null || _a === void 0 ? void 0 : _a.DEV))
    return;
  if (!isInspectorActive())
    return;
  postToParent("asyar:dev:ipc-log", payload);
}
function postToParent(type, payload) {
  try {
    if (typeof window === "undefined")
      return;
    const parent = window.parent;
    if (!parent || parent === window)
      return;
    parent.postMessage({ type, payload }, "*");
  } catch (_a) {
  }
}
var init_devInspectorBridge = __esm({
  "../../shim/node_modules/asyar-sdk/dist/ipc/devInspectorBridge.js"() {
  }
});

// ../../shim/node_modules/asyar-sdk/dist/errors/AsyarError.js
var AsyarError, PermissionDeniedError, PermissionConsentRequiredError, IpcTimeoutError;
var init_AsyarError = __esm({
  "../../shim/node_modules/asyar-sdk/dist/errors/AsyarError.js"() {
    AsyarError = class extends Error {
      constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
      }
    };
    PermissionDeniedError = class extends AsyarError {
      constructor(message, permission) {
        super(message, "PERMISSION_DENIED", permission !== void 0 ? { permission } : void 0);
        this.permission = permission;
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
      }
    };
    PermissionConsentRequiredError = class extends AsyarError {
      constructor(message, permission) {
        super(message, "PERMISSION_CONSENT_REQUIRED", permission !== void 0 ? { permission } : void 0);
        this.permission = permission;
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
      }
    };
    IpcTimeoutError = class extends AsyarError {
      constructor(message, command, timeoutMs) {
        super(message, "IPC_TIMEOUT", command !== void 0 || timeoutMs !== void 0 ? { command, timeoutMs } : void 0);
        this.command = command;
        this.timeoutMs = timeoutMs;
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/errors/index.js
var init_errors = __esm({
  "../../shim/node_modules/asyar-sdk/dist/errors/index.js"() {
    init_AsyarError();
  }
});

// ../../shim/node_modules/asyar-sdk/dist/ipc/MessageBroker.js
var MessageBroker, messageBroker;
var init_MessageBroker = __esm({
  "../../shim/node_modules/asyar-sdk/dist/ipc/MessageBroker.js"() {
    init_devInspectorBridge();
    init_errors();
    MessageBroker = class {
      constructor() {
        this.pendingRequests = /* @__PURE__ */ new Map();
        this.eventListeners = /* @__PURE__ */ new Map();
        this.hostDispatcher = null;
        this.isBrowser = typeof window !== "undefined" && typeof window.parent !== "undefined";
        this.setupListeners();
      }
      setExtensionId(id) {
        this.extensionId = id;
      }
      /**
       * Dispatch host-realm invokes synchronously via `dispatcher` instead of
       * postMessage. Iframes are unaffected.
       */
      setHostDispatcher(dispatcher) {
        this.hostDispatcher = dispatcher;
      }
      isHostRealm() {
        return this.isBrowser && typeof window !== "undefined" && window.parent === window;
      }
      setupListeners() {
        if (this.isBrowser) {
          window.addEventListener("message", this.handleMessage.bind(this));
        } else if (typeof process !== "undefined") {
          if (process.send) {
            process.on("message", this.handleMessage.bind(this));
          } else if (process.stdin) {
            process.stdin.on("data", (data) => {
              try {
                const messages = data.toString().split("\n").filter(Boolean);
                for (const msgStr of messages) {
                  const msg = JSON.parse(msgStr);
                  this.handleMessage(msg);
                }
              } catch (e) {
                console.error("Failed to parse IPC message from stdin", e);
              }
            });
          }
        }
      }
      handleMessage(event) {
        var _a, _b, _c, _d, _e, _f;
        const data = this.isBrowser ? event.data : event;
        if (!data || typeof data !== "object")
          return;
        if (data.type === "asyar:response") {
          const response = data;
          const pending = this.pendingRequests.get(response.messageId);
          if (pending) {
            clearTimeout(pending.timer);
            emitIpcLog({
              phase: "response",
              command: pending.command,
              result: response.error ? void 0 : response.result,
              error: response.error,
              messageId: response.messageId,
              elapsedMs: Date.now() - pending.startedAt,
              timestamp: Date.now(),
              extensionId: this.extensionId
            });
            if (response.error) {
              if (response.errorCode === "PERMISSION_DENIED") {
                const perm = typeof ((_a = response.errorDetails) === null || _a === void 0 ? void 0 : _a.permission) === "string" ? response.errorDetails.permission : void 0;
                pending.reject(new PermissionDeniedError(response.error, perm));
              } else if (response.errorCode === "PERMISSION_CONSENT_REQUIRED") {
                const perm = typeof ((_b = response.errorDetails) === null || _b === void 0 ? void 0 : _b.permission) === "string" ? response.errorDetails.permission : void 0;
                pending.reject(new PermissionConsentRequiredError(response.error, perm));
              } else {
                pending.reject(new AsyarError(response.error, (_c = response.errorCode) !== null && _c !== void 0 ? _c : "UNKNOWN_ERROR", response.errorDetails));
              }
            } else {
              pending.resolve(response.result);
            }
            this.pendingRequests.delete(response.messageId);
          }
        } else if ((_d = data.type) === null || _d === void 0 ? void 0 : _d.startsWith("asyar:event:")) {
          const listeners = this.eventListeners.get(data.type);
          if (listeners) {
            listeners.forEach((listener) => listener(data.payload));
          }
        } else if ((_e = data.type) === null || _e === void 0 ? void 0 : _e.startsWith("asyar:invoke:")) {
          const listeners = this.eventListeners.get(data.type);
          if (listeners) {
            listeners.forEach((listener) => listener(data));
          }
        } else if (data.messageId && ((_f = data.type) === null || _f === void 0 ? void 0 : _f.startsWith("asyar:api:"))) {
          return;
        }
      }
      generateId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      }
      invoke(command, payload, extensionId2, timeoutMs = 1e4) {
        if (this.hostDispatcher && this.isHostRealm()) {
          try {
            return Promise.resolve(this.hostDispatcher(command, payload, extensionId2));
          } catch (err) {
            return Promise.reject(err);
          }
        }
        return new Promise((resolve, reject) => {
          const messageId = this.generateId();
          const startedAt = Date.now();
          const timer = setTimeout(() => {
            this.pendingRequests.delete(messageId);
            emitIpcLog({
              phase: "response",
              command,
              error: `IPC timeout after ${timeoutMs}ms`,
              messageId,
              elapsedMs: timeoutMs,
              timestamp: Date.now(),
              extensionId: extensionId2 !== null && extensionId2 !== void 0 ? extensionId2 : this.extensionId
            });
            reject(new IpcTimeoutError(`IPC timeout after ${timeoutMs}ms for command: ${command}`, command, timeoutMs));
          }, timeoutMs);
          this.pendingRequests.set(messageId, {
            resolve,
            reject,
            timer,
            startedAt,
            command
          });
          const message = Object.assign({ type: `asyar:api:${command}`, payload: payload || {}, messageId }, extensionId2 ? { extensionId: extensionId2 } : {});
          emitIpcLog({
            phase: "invoke",
            command,
            payload,
            messageId,
            timestamp: startedAt,
            extensionId: extensionId2 !== null && extensionId2 !== void 0 ? extensionId2 : this.extensionId
          });
          this.send(message);
        });
      }
      send(message) {
        if (this.isBrowser) {
          window.parent.postMessage(message, "*");
        } else if (typeof process !== "undefined") {
          if (process.send) {
            process.send(message);
          } else if (process.stdout) {
            process.stdout.write(JSON.stringify(message) + "\n");
          }
        }
      }
      on(event, listener) {
        if (!this.eventListeners.has(event)) {
          this.eventListeners.set(event, /* @__PURE__ */ new Set());
        }
        this.eventListeners.get(event).add(listener);
      }
      off(event, listener) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
          listeners.delete(listener);
        }
      }
    };
    messageBroker = new MessageBroker();
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/BaseServiceProxy.js
var BaseServiceProxy;
var init_BaseServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/BaseServiceProxy.js"() {
    init_MessageBroker();
    BaseServiceProxy = class {
      constructor() {
        this.extensionId = "";
        this.broker = messageBroker;
      }
      /**
       * Invoke a wire command, always stamping this proxy's extensionId from
       * `this.extensionId`. Prefer this in returned handles over capturing
       * `this.broker`: the id is injected structurally, so a handle can't ship
       * without it or bind the wrong (global) broker. `this.broker` remains for
       * event subscriptions (`on`/`off`), which don't need the id.
       */
      invoke(command, payload, timeoutMs) {
        return messageBroker.invoke(command, payload, this.extensionId, timeoutMs);
      }
      setExtensionId(id) {
        this.extensionId = id;
        const originalInvoke = this.broker.invoke.bind(this.broker);
        this.broker = Object.create(this.broker);
        this.broker.invoke = (command, payload, _eid, timeoutMs) => originalInvoke(command, payload, id, timeoutMs);
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/LogServiceProxy.js
var LogServiceProxy;
var init_LogServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/LogServiceProxy.js"() {
    init_BaseServiceProxy();
    LogServiceProxy = class extends BaseServiceProxy {
      debug(message) {
        this.broker.invoke("log:debug", { message }).catch((err) => console.warn("[LogServiceProxy] debug failed:", err));
      }
      info(message) {
        this.broker.invoke("log:info", { message }).catch((err) => console.warn("[LogServiceProxy] info failed:", err));
      }
      warn(message) {
        this.broker.invoke("log:warn", { message }).catch((err) => console.warn("[LogServiceProxy] warn failed:", err));
      }
      error(message) {
        const errorMessage = message instanceof Error ? message.message : message;
        this.broker.invoke("log:error", { message: errorMessage }).catch((err) => console.warn("[LogServiceProxy] error failed:", err));
      }
      custom(message, category, colorName, frameName) {
        this.broker.invoke("log:custom", { message, category, colorName, frameName }).catch((err) => console.warn("[LogServiceProxy] custom failed:", err));
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/StorageServiceProxy.js
var __awaiter, StorageServiceProxy;
var init_StorageServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/StorageServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    StorageServiceProxy = class extends BaseServiceProxy {
      get(key) {
        return __awaiter(this, void 0, void 0, function* () {
          return this.broker.invoke("storage:get", { key });
        });
      }
      set(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
          return this.broker.invoke("storage:set", { key, value });
        });
      }
      delete(key) {
        return __awaiter(this, void 0, void 0, function* () {
          return this.broker.invoke("storage:delete", { key });
        });
      }
      getAll() {
        return __awaiter(this, void 0, void 0, function* () {
          return this.broker.invoke("storage:getAll", {});
        });
      }
      clear() {
        return __awaiter(this, void 0, void 0, function* () {
          return this.broker.invoke("storage:clear", {});
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/NotesServiceProxy.js
var __awaiter2, NotesServiceProxy;
var init_NotesServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/NotesServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter2 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    NotesServiceProxy = class extends BaseServiceProxy {
      search(query, limit) {
        return __awaiter2(this, void 0, void 0, function* () {
          return this.broker.invoke("notes:search", { query, limit });
        });
      }
      list(limit) {
        return __awaiter2(this, void 0, void 0, function* () {
          return this.broker.invoke("notes:list", { limit });
        });
      }
      get(idOrTitle) {
        return __awaiter2(this, void 0, void 0, function* () {
          return this.broker.invoke("notes:get", { idOrTitle });
        });
      }
      create(title, body) {
        return __awaiter2(this, void 0, void 0, function* () {
          return this.broker.invoke("notes:create", { title, body });
        });
      }
      append(idOrTitle, text) {
        return __awaiter2(this, void 0, void 0, function* () {
          return this.broker.invoke("notes:append", { idOrTitle, text });
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/CacheServiceProxy.js
var __awaiter3, CacheServiceProxy;
var init_CacheServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/CacheServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter3 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    CacheServiceProxy = class extends BaseServiceProxy {
      /**
       * Gets a value from the cache.
       */
      get(key) {
        return __awaiter3(this, void 0, void 0, function* () {
          const value = yield this.broker.invoke("cache:get", {
            key
          });
          return value !== null && value !== void 0 ? value : void 0;
        });
      }
      /**
       * Sets a value in the cache with an optional expiration date.
       */
      set(key, value, options) {
        return __awaiter3(this, void 0, void 0, function* () {
          const expiresAt = (options === null || options === void 0 ? void 0 : options.expirationDate) ? Math.floor(options.expirationDate.getTime() / 1e3) : void 0;
          return this.broker.invoke("cache:set", {
            key,
            value,
            expiresAt
          });
        });
      }
      /**
       * Removes a value from the cache.
       */
      remove(key) {
        return __awaiter3(this, void 0, void 0, function* () {
          return this.broker.invoke("cache:delete", {
            key
          });
        });
      }
      /**
       * Clears all cache entries for the current extension.
       */
      clear() {
        return __awaiter3(this, void 0, void 0, function* () {
          return this.broker.invoke("cache:clear", {});
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/SearchServiceProxy.js
var __awaiter4, SearchServiceProxy;
var init_SearchServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/SearchServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter4 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    SearchServiceProxy = class extends BaseServiceProxy {
      rank(query, items) {
        return __awaiter4(this, void 0, void 0, function* () {
          return this.broker.invoke("search:rank", { query, items });
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/NetworkServiceProxy.js
var __awaiter5, NetworkServiceProxy;
var init_NetworkServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/NetworkServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter5 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    NetworkServiceProxy = class extends BaseServiceProxy {
      fetch(url, options) {
        return __awaiter5(this, void 0, void 0, function* () {
          var _a;
          const invokePromise = this.broker.invoke("network:fetch", { url, options: options !== null && options !== void 0 ? options : {} });
          const ipcTimeout = ((_a = options === null || options === void 0 ? void 0 : options.timeout) !== null && _a !== void 0 ? _a : 25e3) + 15e3;
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`IPC Request timed out after ${ipcTimeout}ms`)), ipcTimeout));
          return Promise.race([invokePromise, timeoutPromise]);
        });
      }
      connectWebSocket(url, options) {
        return __awaiter5(this, void 0, void 0, function* () {
          const socketId = `ws_${Math.random().toString(36).slice(2)}_${Date.now()}`;
          const openListeners = /* @__PURE__ */ new Set();
          const messageListeners = /* @__PURE__ */ new Set();
          const errorListeners = /* @__PURE__ */ new Set();
          const closeListeners = /* @__PURE__ */ new Set();
          let didOpen = false;
          let closeInfo = null;
          let closeFired = false;
          const fireCloseOnce = (info) => {
            if (closeFired)
              return;
            closeFired = true;
            closeInfo = info;
            this.broker.off("asyar:event:network:wsMessage:push", listener);
            closeListeners.forEach((cb) => cb(info));
          };
          const listener = (payload) => {
            const p = payload;
            if ((p === null || p === void 0 ? void 0 : p.socket_id) !== socketId)
              return;
            switch (p.event_type) {
              case "open":
                didOpen = true;
                openListeners.forEach((cb) => cb());
                break;
              case "message":
                if (p.data !== void 0) {
                  messageListeners.forEach((cb) => cb(p.data));
                }
                break;
              case "error":
                if (p.data !== void 0) {
                  errorListeners.forEach((cb) => cb(p.data));
                }
                break;
              case "close":
                fireCloseOnce({ code: p.code, reason: p.data });
                break;
            }
          };
          this.broker.on("asyar:event:network:wsMessage:push", listener);
          try {
            yield this.broker.invoke("network:wsConnect", {
              socketId,
              url,
              headers: options === null || options === void 0 ? void 0 : options.headers
            });
          } catch (err) {
            this.broker.off("asyar:event:network:wsMessage:push", listener);
            throw err;
          }
          const broker = this.broker;
          const handle = {
            socketId,
            send(data) {
              return __awaiter5(this, void 0, void 0, function* () {
                yield broker.invoke("network:wsSend", { socketId, message: data });
              });
            },
            close(code, reason) {
              return __awaiter5(this, void 0, void 0, function* () {
                yield broker.invoke("network:wsClose", { socketId, code, reason });
              });
            },
            onOpen(callback) {
              openListeners.add(callback);
              if (didOpen)
                callback();
              return () => openListeners.delete(callback);
            },
            onMessage(callback) {
              messageListeners.add(callback);
              return () => messageListeners.delete(callback);
            },
            onError(callback) {
              errorListeners.add(callback);
              return () => errorListeners.delete(callback);
            },
            onClose(callback) {
              closeListeners.add(callback);
              if (closeInfo)
                callback(closeInfo);
              return () => closeListeners.delete(callback);
            }
          };
          return handle;
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/ShellServiceProxy.js
var __awaiter6, ShellServiceProxy;
var init_ShellServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/ShellServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter6 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    ShellServiceProxy = class extends BaseServiceProxy {
      spawn(params) {
        const spawnId = crypto.randomUUID();
        return this.buildHandle(spawnId, "SPAWN_FAILED", () => this.broker.invoke("shell:spawn", {
          program: params.program,
          args: params.args,
          spawnId,
          stdin: params.stdin
        }));
      }
      list() {
        return __awaiter6(this, void 0, void 0, function* () {
          const result = yield this.broker.invoke("shell:list", {});
          return result !== null && result !== void 0 ? result : [];
        });
      }
      attach(spawnId) {
        return this.buildHandle(spawnId, "ATTACH_FAILED", () => this.broker.invoke("shell:attach", { spawnId }));
      }
      /**
       * Shared listener plumbing used by both `spawn` and `attach`. Registers
       * the message listener BEFORE the IPC call so that no phase event fired
       * by the host side between invoke and the listener attach can be lost.
       */
      buildHandle(spawnId, invokeErrorCode, invokeCall) {
        let settled = false;
        let chunkCb = () => {
        };
        let doneCb = () => {
        };
        let errorCb = () => {
        };
        const cleanup = () => {
          window.removeEventListener("message", onMessage);
        };
        const settle = (err, exitCode) => {
          if (settled)
            return;
          settled = true;
          cleanup();
          if (err) {
            errorCb(err);
          } else {
            doneCb(exitCode);
          }
        };
        const onMessage = (event) => {
          const msg = event.data;
          if ((msg === null || msg === void 0 ? void 0 : msg.type) !== "asyar:stream" || (msg === null || msg === void 0 ? void 0 : msg.streamId) !== spawnId) {
            return;
          }
          const { phase, data } = msg;
          switch (phase) {
            case "chunk":
              if (data) {
                chunkCb(data);
              }
              break;
            case "done":
              settle(void 0, data === null || data === void 0 ? void 0 : data.exitCode);
              break;
            case "error":
              settle((data === null || data === void 0 ? void 0 : data.error) || { code: "UNKNOWN_ERROR", message: "Unknown shell stream error" });
              break;
          }
        };
        window.addEventListener("message", onMessage);
        invokeCall().catch((err) => {
          const errorStr = String(err.message || err);
          settle({ code: invokeErrorCode, message: errorStr });
        });
        return {
          spawnId,
          onChunk: (cb) => {
            chunkCb = cb;
          },
          onDone: (cb) => {
            doneCb = cb;
          },
          onError: (cb) => {
            errorCb = cb;
          },
          abort: () => {
            if (settled)
              return;
            window.parent.postMessage({
              type: "asyar:stream:abort",
              streamId: spawnId
            }, "*");
            settle({ code: "ABORTED", message: "Process was aborted by the extension" });
          },
          write: (data) => __awaiter6(this, void 0, void 0, function* () {
            if (settled) {
              throw new Error("Process is no longer running");
            }
            yield this.broker.invoke("shell:write-stdin", { spawnId, data });
          }),
          closeStdin: () => __awaiter6(this, void 0, void 0, function* () {
            if (settled) {
              return;
            }
            yield this.broker.invoke("shell:close-stdin", { spawnId });
          })
        };
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/OAuthServiceProxy.js
var OAuthServiceProxy;
var init_OAuthServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/OAuthServiceProxy.js"() {
    init_BaseServiceProxy();
    OAuthServiceProxy = class extends BaseServiceProxy {
      authorize(config) {
        return new Promise((resolve, reject) => {
          const flowId = crypto.randomUUID();
          const handler = (event) => {
            const msg = event.data;
            if ((msg === null || msg === void 0 ? void 0 : msg.type) !== "asyar:oauth:result")
              return;
            if ((msg === null || msg === void 0 ? void 0 : msg.flowId) !== flowId)
              return;
            window.removeEventListener("message", handler);
            if (msg.error) {
              const err = msg.error;
              reject(new Error(`OAuth error [${err.code}]: ${err.message}`));
            } else {
              resolve(msg.token);
            }
          };
          window.addEventListener("message", handler);
          this.broker.invoke("oauth:authorize", {
            // Key insertion order must match Object.values() dispatch in IpcRouter,
            // which maps to host service parameter order after extensionId injection:
            // authorize(extensionId, providerId, clientId, authorizationUrl, tokenUrl, scopes, flowId)
            providerId: config.providerId,
            clientId: config.clientId,
            authorizationUrl: config.authorizationUrl,
            tokenUrl: config.tokenUrl,
            scopes: config.scopes,
            flowId
          }).then((result) => {
            if ("accessToken" in result) {
              window.removeEventListener("message", handler);
              resolve(result);
            }
          }).catch((err) => {
            window.removeEventListener("message", handler);
            reject(err);
          });
        });
      }
      revokeToken(providerId) {
        return this.broker.invoke("oauth:revokeToken", { providerId });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/FileManagerServiceProxy.js
var __awaiter7, FileManagerServiceProxy;
var init_FileManagerServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/FileManagerServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter7 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    FileManagerServiceProxy = class extends BaseServiceProxy {
      showInFileManager(path) {
        return __awaiter7(this, void 0, void 0, function* () {
          return this.broker.invoke("fs:showInFileManager", { path });
        });
      }
      trash(path) {
        return __awaiter7(this, void 0, void 0, function* () {
          return this.broker.invoke("fs:trash", { path });
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/ApplicationService.js
var __awaiter8, ApplicationServiceProxy;
var init_ApplicationService = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/ApplicationService.js"() {
    init_BaseServiceProxy();
    __awaiter8 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    ApplicationServiceProxy = class extends BaseServiceProxy {
      constructor() {
        super(...arguments);
        this.states = /* @__PURE__ */ new Map();
        this.pushListenerInstalled = false;
        this.indexStates = /* @__PURE__ */ new Map();
        this.indexPushListenerInstalled = false;
      }
      getFrontmostApplication() {
        return __awaiter8(this, void 0, void 0, function* () {
          return yield this.broker.invoke("application:getFrontmostApplication");
        });
      }
      syncApplicationIndex(extraPaths) {
        return __awaiter8(this, void 0, void 0, function* () {
          return yield this.broker.invoke("application:syncApplicationIndex", { extraPaths });
        });
      }
      listApplications(extraPaths) {
        return __awaiter8(this, void 0, void 0, function* () {
          return yield this.broker.invoke("application:listApplications", {
            extraPaths
          });
        });
      }
      isRunning(bundleId) {
        return __awaiter8(this, void 0, void 0, function* () {
          return yield this.broker.invoke("application:isRunning", { bundleId });
        });
      }
      onApplicationLaunched(cb) {
        return this.listen("launched", cb);
      }
      onApplicationTerminated(cb) {
        return this.listen("terminated", cb);
      }
      onFrontmostApplicationChanged(cb) {
        return this.listen("frontmost-changed", cb);
      }
      onApplicationsChanged(cb) {
        return this.listenIndex("applications-changed", cb);
      }
      ensurePushListener() {
        if (this.pushListenerInstalled)
          return;
        this.pushListenerInstalled = true;
        this.broker.on("asyar:event:app-event:push", (payload) => {
          if (!payload || typeof payload !== "object" || !("type" in payload))
            return;
          const ev = payload;
          const state = this.states.get(ev.type);
          if (!state)
            return;
          for (const cb of state.callbacks) {
            try {
              cb(ev);
            } catch (_a) {
            }
          }
        });
      }
      listen(kind, dispatch) {
        this.ensurePushListener();
        let state = this.states.get(kind);
        if (!state) {
          const subscriptionIdPromise = this.broker.invoke("appEvents:subscribe", {
            eventTypes: [kind]
          });
          state = { subscriptionIdPromise, callbacks: /* @__PURE__ */ new Set() };
          this.states.set(kind, state);
        }
        const wrapped = (ev) => dispatch(ev);
        state.callbacks.add(wrapped);
        let disposed = false;
        return () => {
          if (disposed)
            return;
          disposed = true;
          const s = this.states.get(kind);
          if (!s)
            return;
          s.callbacks.delete(wrapped);
          if (s.callbacks.size === 0) {
            this.states.delete(kind);
            s.subscriptionIdPromise.then((id) => this.broker.invoke("appEvents:unsubscribe", {
              subscriptionId: id
            })).catch(() => {
            });
          }
        };
      }
      /**
       * Index-event analog of [`ensurePushListener`]. Attaches one
       * `asyar:event:application-index:push` listener for the lifetime of the
       * proxy; the listener fans the payload out to the per-kind callback set.
       */
      ensureIndexPushListener() {
        if (this.indexPushListenerInstalled)
          return;
        this.indexPushListenerInstalled = true;
        this.broker.on("asyar:event:application-index:push", (payload) => {
          if (!payload || typeof payload !== "object" || !("type" in payload))
            return;
          const ev = payload;
          const state = this.indexStates.get(ev.type);
          if (!state)
            return;
          for (const cb of state.callbacks) {
            try {
              cb(ev);
            } catch (_a) {
            }
          }
        });
      }
      /**
       * Ref-counted subscribe on the `applicationIndex:*` namespace. Same
       * shape as [`listen`] but keyed on [`ApplicationIndexEventKind`] so the
       * index and presence surfaces don't share state.
       */
      listenIndex(kind, dispatch) {
        this.ensureIndexPushListener();
        let state = this.indexStates.get(kind);
        if (!state) {
          const subscriptionIdPromise = this.broker.invoke("applicationIndex:subscribe", {
            eventTypes: [kind]
          });
          state = { subscriptionIdPromise, callbacks: /* @__PURE__ */ new Set() };
          this.indexStates.set(kind, state);
        }
        state.callbacks.add(dispatch);
        let disposed = false;
        return () => {
          if (disposed)
            return;
          disposed = true;
          const s = this.indexStates.get(kind);
          if (!s)
            return;
          s.callbacks.delete(dispatch);
          if (s.callbacks.size === 0) {
            this.indexStates.delete(kind);
            s.subscriptionIdPromise.then((id) => this.broker.invoke("applicationIndex:unsubscribe", {
              subscriptionId: id
            })).catch(() => {
            });
          }
        };
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/PowerServiceProxy.js
var __awaiter9, PowerServiceProxy;
var init_PowerServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/PowerServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter9 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    PowerServiceProxy = class extends BaseServiceProxy {
      keepAwake(options) {
        return __awaiter9(this, void 0, void 0, function* () {
          return this.broker.invoke("power:keepAwake", { options });
        });
      }
      release(token) {
        return __awaiter9(this, void 0, void 0, function* () {
          return this.broker.invoke("power:release", { token });
        });
      }
      list() {
        return __awaiter9(this, void 0, void 0, function* () {
          return this.broker.invoke("power:list", {});
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/ScreenServiceProxy.js
var __awaiter10, ScreenServiceProxy;
var init_ScreenServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/ScreenServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter10 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    ScreenServiceProxy = class extends BaseServiceProxy {
      pickColor() {
        return __awaiter10(this, void 0, void 0, function* () {
          return this.broker.invoke("screen:pickColor", {});
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/ProcessServiceProxy.js
var __awaiter11, ProcessServiceProxy;
var init_ProcessServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/ProcessServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter11 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    ProcessServiceProxy = class extends BaseServiceProxy {
      list(options) {
        return __awaiter11(this, void 0, void 0, function* () {
          return this.broker.invoke("process:list", {
            query: options.query,
            sortBy: options.sortBy
          });
        });
      }
      kill(options) {
        return __awaiter11(this, void 0, void 0, function* () {
          var _a;
          return this.broker.invoke("process:kill", {
            pids: options.pids,
            force: options.force,
            confirmedProtected: (_a = options.confirmedProtected) !== null && _a !== void 0 ? _a : false
          });
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/SystemEventsServiceProxy.js
var SystemEventsServiceProxy;
var init_SystemEventsServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/SystemEventsServiceProxy.js"() {
    init_BaseServiceProxy();
    SystemEventsServiceProxy = class extends BaseServiceProxy {
      constructor() {
        super(...arguments);
        this.states = /* @__PURE__ */ new Map();
        this.pushListenerInstalled = false;
      }
      ensurePushListener() {
        if (this.pushListenerInstalled)
          return;
        this.pushListenerInstalled = true;
        this.broker.on("asyar:event:system-event:push", (payload) => {
          if (!payload || typeof payload !== "object" || !("type" in payload))
            return;
          const ev = payload;
          const state = this.states.get(ev.type);
          if (!state)
            return;
          for (const cb of state.callbacks) {
            try {
              cb(ev);
            } catch (_a) {
            }
          }
        });
      }
      listen(kind, dispatch) {
        this.ensurePushListener();
        let state = this.states.get(kind);
        if (!state) {
          const subscriptionIdPromise = this.broker.invoke("systemEvents:subscribe", {
            eventTypes: [kind]
          });
          state = { subscriptionIdPromise, callbacks: /* @__PURE__ */ new Set() };
          this.states.set(kind, state);
        }
        const wrapped = (ev) => dispatch(ev);
        state.callbacks.add(wrapped);
        let disposed = false;
        return () => {
          if (disposed)
            return;
          disposed = true;
          const s = this.states.get(kind);
          if (!s)
            return;
          s.callbacks.delete(wrapped);
          if (s.callbacks.size === 0) {
            this.states.delete(kind);
            s.subscriptionIdPromise.then((id) => this.broker.invoke("systemEvents:unsubscribe", {
              subscriptionId: id
            })).catch(() => {
            });
          }
        };
      }
      onSystemSleep(cb) {
        return this.listen("sleep", () => cb());
      }
      onSystemWake(cb) {
        return this.listen("wake", () => cb());
      }
      onLidOpen(cb) {
        return this.listen("lid-open", () => cb());
      }
      onLidClose(cb) {
        return this.listen("lid-close", () => cb());
      }
      onBatteryLevelChange(cb) {
        return this.listen("battery-level-changed", (ev) => cb(ev.percent));
      }
      onPowerSourceChange(cb) {
        return this.listen("power-source-changed", (ev) => cb(ev.onBattery));
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/TimerServiceProxy.js
var __awaiter12, TimerServiceProxy;
var init_TimerServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/TimerServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter12 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    TimerServiceProxy = class extends BaseServiceProxy {
      schedule(opts) {
        return __awaiter12(this, void 0, void 0, function* () {
          return this.broker.invoke("timers:schedule", { opts });
        });
      }
      cancel(timerId) {
        return __awaiter12(this, void 0, void 0, function* () {
          return this.broker.invoke("timers:cancel", { timerId });
        });
      }
      list() {
        return __awaiter12(this, void 0, void 0, function* () {
          return this.broker.invoke("timers:list", {});
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/FileSystemWatcherService.js
var __awaiter13, FileSystemWatcherServiceProxy;
var init_FileSystemWatcherService = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/FileSystemWatcherService.js"() {
    init_BaseServiceProxy();
    __awaiter13 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    FileSystemWatcherServiceProxy = class extends BaseServiceProxy {
      constructor() {
        super(...arguments);
        this.callbacks = /* @__PURE__ */ new Map();
        this.pushListenerInstalled = false;
      }
      watch(paths, opts) {
        return __awaiter13(this, void 0, void 0, function* () {
          this.ensurePushListener();
          const handleId = yield this.broker.invoke("fsWatcher:create", {
            paths,
            opts: opts !== null && opts !== void 0 ? opts : {}
          });
          if (!this.callbacks.has(handleId)) {
            this.callbacks.set(handleId, /* @__PURE__ */ new Set());
          }
          return this.buildHandle(handleId);
        });
      }
      ensurePushListener() {
        if (this.pushListenerInstalled)
          return;
        this.pushListenerInstalled = true;
        this.broker.on("asyar:event:fs-watch:push", (payload) => {
          const p = payload;
          if (!p || typeof p.handleId !== "string" || !p.change)
            return;
          const cbs = this.callbacks.get(p.handleId);
          if (!cbs)
            return;
          for (const cb of cbs) {
            try {
              cb(p.change);
            } catch (_a) {
            }
          }
        });
      }
      buildHandle(handleId) {
        let disposed = false;
        return {
          onChange: (cb) => {
            if (disposed)
              return () => void 0;
            const cbs = this.callbacks.get(handleId);
            cbs === null || cbs === void 0 ? void 0 : cbs.add(cb);
            return () => {
              cbs === null || cbs === void 0 ? void 0 : cbs.delete(cb);
            };
          },
          dispose: () => __awaiter13(this, void 0, void 0, function* () {
            if (disposed)
              return;
            disposed = true;
            this.callbacks.delete(handleId);
            try {
              yield this.broker.invoke("fsWatcher:dispose", { handleId });
            } catch (_a) {
            }
          })
        };
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/statusBarValidation.js
function validateTopLevelStatusBarItem(item) {
  if (!item || typeof item !== "object") {
    throw new StatusBarValidationError("Status-bar item must be an object");
  }
  if (typeof item.id !== "string" || item.id.trim() === "") {
    throw new StatusBarValidationError("Top-level status-bar item id must be a non-empty string");
  }
  if (typeof item.text !== "string") {
    throw new StatusBarValidationError(`Top-level status-bar item '${item.id}' requires a string 'text' field`);
  }
  if (item.separator === true) {
    throw new StatusBarValidationError(`Top-level status-bar items cannot be separators (item '${item.id}')`);
  }
  if (item.checked !== void 0) {
    throw new StatusBarValidationError(`Top-level status-bar items cannot have a checked state (item '${item.id}')`);
  }
  if (item.enabled === false) {
    throw new StatusBarValidationError(`Top-level status-bar items cannot be disabled (item '${item.id}')`);
  }
  const hasIcon = typeof item.icon === "string" && item.icon.length > 0 || typeof item.iconPath === "string" && item.iconPath.length > 0;
  if (!hasIcon) {
    throw new StatusBarValidationError(`Top-level status-bar item '${item.id}' must provide 'icon' or 'iconPath'`);
  }
  if (item.id.includes(":")) {
    throw new StatusBarValidationError(`Status-bar item id '${item.id}' cannot contain ':' (reserved path separator)`);
  }
  if (Array.isArray(item.submenu)) {
    validateSiblings(item.submenu, 2);
  } else if (item.submenu !== void 0) {
    throw new StatusBarValidationError(`submenu on item '${item.id}' must be an array when present`);
  }
}
function validateSiblings(items, depth) {
  if (depth > MAX_STATUS_BAR_DEPTH) {
    throw new StatusBarValidationError(`Status-bar submenu nested deeper than max depth ${MAX_STATUS_BAR_DEPTH}`);
  }
  const seenIds = /* @__PURE__ */ new Set();
  for (const child of items) {
    if (!child || typeof child !== "object") {
      throw new StatusBarValidationError("Submenu item must be an object");
    }
    if (child.separator === true) {
      if (child.submenu !== void 0) {
        throw new StatusBarValidationError("Separator rows cannot have a submenu");
      }
      if (child.checked !== void 0) {
        throw new StatusBarValidationError("Separator rows cannot be checkable");
      }
      continue;
    }
    if (typeof child.id !== "string" || child.id.trim() === "") {
      throw new StatusBarValidationError("Submenu item id must be a non-empty string");
    }
    if (child.id.includes(":")) {
      throw new StatusBarValidationError(`Status-bar item id '${child.id}' cannot contain ':' (reserved path separator)`);
    }
    if (seenIds.has(child.id)) {
      throw new StatusBarValidationError(`Duplicate sibling id '${child.id}' inside submenu`);
    }
    seenIds.add(child.id);
    if (Array.isArray(child.submenu)) {
      validateSiblings(child.submenu, depth + 1);
    } else if (child.submenu !== void 0) {
      throw new StatusBarValidationError(`submenu on item '${child.id}' must be an array when present`);
    }
  }
}
function stripHandlers(item) {
  const { onClick: _onClick, submenu } = item, rest = __rest(item, ["onClick", "submenu"]);
  const copy = Object.assign({}, rest);
  if (Array.isArray(submenu)) {
    copy.submenu = submenu.map(stripHandlers);
  }
  return copy;
}
function collectHandlers(item) {
  const out = /* @__PURE__ */ new Map();
  walk(item, [], out);
  return out;
}
function walk(item, parentPath, out) {
  var _a;
  if (item.separator === true)
    return;
  const path = [...parentPath, (_a = item.id) !== null && _a !== void 0 ? _a : ""];
  if (typeof item.onClick === "function") {
    out.set(path.join(":"), item.onClick);
  }
  if (Array.isArray(item.submenu)) {
    for (const child of item.submenu) {
      walk(child, path, out);
    }
  }
}
var __rest, MAX_STATUS_BAR_DEPTH, StatusBarValidationError;
var init_statusBarValidation = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/statusBarValidation.js"() {
    __rest = function(s, e) {
      var t = {};
      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
      if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
          if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
            t[p[i]] = s[p[i]];
        }
      return t;
    };
    MAX_STATUS_BAR_DEPTH = 4;
    StatusBarValidationError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "StatusBarValidationError";
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/StatusBarServiceProxy.js
var StatusBarServiceProxy;
var init_StatusBarServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/StatusBarServiceProxy.js"() {
    init_BaseServiceProxy();
    init_statusBarValidation();
    StatusBarServiceProxy = class extends BaseServiceProxy {
      constructor() {
        super(...arguments);
        this.handlersByTop = /* @__PURE__ */ new Map();
        this.clickListenerBound = false;
      }
      registerItem(item) {
        validateTopLevelStatusBarItem(item);
        this.handlersByTop.set(item.id, collectHandlers(item));
        this.ensureClickListener();
        const fullItem = Object.assign(Object.assign({}, stripHandlers(item)), { extensionId: this.extensionId });
        this.broker.invoke("statusBar:registerItem", { item: fullItem }).catch((err) => console.warn("[StatusBarServiceProxy] registerItem failed:", err));
      }
      updateItem(id, updates) {
        const merged = Object.assign({ id, text: "" }, updates);
        if (typeof merged.id !== "string" || merged.id.trim() === "") {
          throw new Error("updateItem requires a non-empty id");
        }
        validateTopLevelStatusBarItem(merged);
        this.handlersByTop.set(merged.id, collectHandlers(merged));
        this.ensureClickListener();
        const fullItem = Object.assign(Object.assign({}, stripHandlers(merged)), { extensionId: this.extensionId });
        this.broker.invoke("statusBar:updateItem", {
          extensionId: this.extensionId,
          id,
          item: fullItem
        }).catch((err) => console.warn("[StatusBarServiceProxy] updateItem failed:", err));
      }
      unregisterItem(id) {
        this.handlersByTop.delete(id);
        this.broker.invoke("statusBar:unregisterItem", { extensionId: this.extensionId, id }).catch((err) => console.warn("[StatusBarServiceProxy] unregisterItem failed:", err));
      }
      ensureClickListener() {
        if (this.clickListenerBound)
          return;
        this.clickListenerBound = true;
        this.broker.on("asyar:event:statusBar:click", (payload) => this.dispatchClick(payload));
      }
      dispatchClick(payload) {
        if (!payload || !Array.isArray(payload.itemPath) || payload.itemPath.length === 0) {
          console.warn("[StatusBarServiceProxy] click payload missing itemPath", payload);
          return;
        }
        const [topId] = payload.itemPath;
        const handlers = this.handlersByTop.get(topId);
        if (!handlers) {
          console.warn(`[StatusBarServiceProxy] no handler map for top-level id '${topId}'`, {
            known: [...this.handlersByTop.keys()]
          });
          return;
        }
        const key = payload.itemPath.join(":");
        const handler = handlers.get(key);
        if (!handler)
          return;
        try {
          handler({ itemPath: payload.itemPath, checked: payload.checked });
        } catch (err) {
          console.warn("[StatusBarServiceProxy] onClick handler threw:", err);
        }
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/LogService.js
var init_LogService = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/LogService.js"() {
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/IClipboardHistoryService.js
var init_IClipboardHistoryService = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/IClipboardHistoryService.js"() {
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/IExtensionManager.js
var init_IExtensionManager = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/IExtensionManager.js"() {
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/ICommandService.js
var init_ICommandService = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/ICommandService.js"() {
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/ISettingsService.js
var init_ISettingsService = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/ISettingsService.js"() {
  }
});

// ../../shim/node_modules/asyar-sdk/dist/types/ClipboardType.js
var ClipboardItemType;
var init_ClipboardType = __esm({
  "../../shim/node_modules/asyar-sdk/dist/types/ClipboardType.js"() {
    (function(ClipboardItemType2) {
      ClipboardItemType2["Text"] = "text";
      ClipboardItemType2["Html"] = "html";
      ClipboardItemType2["Rtf"] = "rtf";
      ClipboardItemType2["Image"] = "image";
      ClipboardItemType2["Files"] = "files";
    })(ClipboardItemType || (ClipboardItemType = {}));
  }
});

// ../../shim/node_modules/asyar-sdk/dist/types/ActionType.js
var ActionContext;
var init_ActionType = __esm({
  "../../shim/node_modules/asyar-sdk/dist/types/ActionType.js"() {
    (function(ActionContext2) {
      ActionContext2["GLOBAL"] = "global";
      ActionContext2["EXTENSION_VIEW"] = "extension_view";
      ActionContext2["SEARCH_VIEW"] = "search_view";
      ActionContext2["RESULT"] = "result";
      ActionContext2["CORE"] = "core";
      ActionContext2["COMMAND_RESULT"] = "command_result";
    })(ActionContext || (ActionContext = {}));
  }
});

// ../../shim/node_modules/asyar-sdk/dist/types/EnvironmentType.js
var init_EnvironmentType = __esm({
  "../../shim/node_modules/asyar-sdk/dist/types/EnvironmentType.js"() {
  }
});

// ../../shim/node_modules/asyar-sdk/dist/types/index.js
var init_types = __esm({
  "../../shim/node_modules/asyar-sdk/dist/types/index.js"() {
    init_ClipboardType();
    init_ActionType();
    init_EnvironmentType();
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/ClipboardHistoryServiceProxy.js
var ClipboardHistoryServiceProxy;
var init_ClipboardHistoryServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/ClipboardHistoryServiceProxy.js"() {
    init_types();
    init_BaseServiceProxy();
    ClipboardHistoryServiceProxy = class extends BaseServiceProxy {
      initialize() {
        return this.broker.invoke("clipboard:initialize");
      }
      stopMonitoring() {
        this.broker.invoke("clipboard:stopMonitoring").catch((err) => console.warn("[ClipboardHistoryServiceProxy] stopMonitoring failed:", err));
      }
      formatClipboardItem(item) {
        if (item.type === ClipboardItemType.Text || item.type === ClipboardItemType.Html) {
          return item.content || "";
        }
        if (item.type === ClipboardItemType.Rtf) {
          return item.content || "[RTF item]";
        }
        if (item.type === ClipboardItemType.Files) {
          try {
            const paths = JSON.parse(item.content || "[]");
            return `[${paths.length} file${paths.length !== 1 ? "s" : ""}]`;
          } catch (_a) {
            return "[Files]";
          }
        }
        return `[${item.type} item]`;
      }
      pasteItem(item) {
        return this.broker.invoke("clipboard:pasteItem", { item });
      }
      hideWindow() {
        return this.broker.invoke("clipboard:hideWindow");
      }
      simulatePaste() {
        return this.broker.invoke("clipboard:simulatePaste");
      }
      writeToClipboard(item) {
        return this.broker.invoke("clipboard:writeToClipboard", { item });
      }
      getRecentItems(limit) {
        return this.broker.invoke("clipboard:getRecentItems", { limit });
      }
      toggleItemFavorite(itemId) {
        return this.broker.invoke("clipboard:toggleItemFavorite", { itemId });
      }
      deleteItem(itemId) {
        return this.broker.invoke("clipboard:deleteItem", { itemId });
      }
      clearNonFavorites() {
        return this.broker.invoke("clipboard:clearNonFavorites");
      }
      normalizeImageData(content) {
        if (content.startsWith("data:image"))
          return content;
        return `data:image/png;base64,${content}`;
      }
      isValidImageData(content) {
        return content.startsWith("data:image") || /^[A-Za-z0-9+/=]+$/.test(content);
      }
      readCurrentClipboard() {
        return this.broker.invoke("clipboard:readCurrentClipboard");
      }
      readCurrentText() {
        return this.broker.invoke("clipboard:readCurrentText");
      }
      stripHtml(html) {
        return this.broker.invoke("clipboard:stripHtml", { html });
      }
      stripRtf(rtf) {
        return this.broker.invoke("clipboard:stripRtf", { rtf });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/ExtensionManagerProxy.js
var ExtensionManagerProxy;
var init_ExtensionManagerProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/ExtensionManagerProxy.js"() {
    init_BaseServiceProxy();
    ExtensionManagerProxy = class extends BaseServiceProxy {
      constructor() {
        super(...arguments);
        this._currentExtension = null;
        this.isReady = false;
      }
      get currentExtension() {
        return this._currentExtension;
      }
      set currentExtension(value) {
        this._currentExtension = value;
      }
      init() {
        return this.broker.invoke("extensions:init");
      }
      loadExtensions() {
        return this.broker.invoke("extensions:loadExtensions");
      }
      reloadExtensions() {
        return this.broker.invoke("extensions:reloadExtensions");
      }
      isExtensionEnabled(extensionName) {
        console.warn("isExtensionEnabled called synchronously in proxy. Returning true as fallback.");
        return true;
      }
      toggleExtensionState(extensionName, enabled) {
        return this.broker.invoke("extensions:toggleExtensionState", {
          extensionName,
          enabled
        });
      }
      getAllExtensionsWithState() {
        return this.broker.invoke("extensions:getAllExtensionsWithState");
      }
      searchAll(query) {
        return this.broker.invoke("extensions:searchAll", { query });
      }
      handleViewSearch(query) {
        return this.broker.invoke("extensions:handleViewSearch", { query });
      }
      handleViewSubmit(query) {
        return this.broker.invoke("extensions:handleViewSubmit", { query });
      }
      navigateToView(viewPath) {
        this.broker.invoke("extensions:navigateToView", { viewPath }).catch((err) => console.warn("[ExtensionManagerProxy] navigateToView failed:", err));
      }
      goBack() {
        this.broker.invoke("extensions:goBack").catch((err) => console.warn("[ExtensionManagerProxy] goBack failed:", err));
      }
      forwardKeyToActiveView(keyEvent) {
        this.broker.invoke("extensions:forwardKeyToActiveView", { keyEvent }).catch((err) => console.warn("[ExtensionManagerProxy] forwardKeyToActiveView failed:", err));
      }
      getAllExtensions() {
        return this.broker.invoke("extensions:getAllExtensions");
      }
      uninstallExtension(extensionId2, extensionName) {
        return this.broker.invoke("extensions:uninstallExtension", {
          extensionId: extensionId2,
          extensionName
        });
      }
      setActiveViewActionLabel(label) {
        this.broker.invoke("extensions:setActiveViewActionLabel", { label }).catch((err) => console.warn("[ExtensionManagerProxy] setActiveViewActionLabel failed:", err));
      }
      setActiveViewSubtitle(subtitle) {
        this.broker.invoke("extensions:setActiveViewSubtitle", { subtitle }).catch((err) => console.warn("[ExtensionManagerProxy] setActiveViewSubtitle failed:", err));
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/ActionServiceProxy.js
var __rest2, ActionServiceProxy;
var init_ActionServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/ActionServiceProxy.js"() {
    init_types();
    init_BaseServiceProxy();
    init_ExtensionBridge();
    __rest2 = function(s, e) {
      var t = {};
      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
      if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
          if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
            t[p[i]] = s[p[i]];
        }
      return t;
    };
    ActionServiceProxy = class extends BaseServiceProxy {
      constructor() {
        super(...arguments);
        this.currentContext = ActionContext.GLOBAL;
      }
      registerAction(action) {
        extensionBridge.registerAction(action.extensionId, action);
        const { execute } = action, actionData = __rest2(action, ["execute"]);
        this.broker.invoke("actions:registerAction", { action: actionData }).catch((err) => console.warn("[ActionServiceProxy] registerAction failed:", err));
      }
      unregisterAction(actionId) {
        extensionBridge.unregisterAction(actionId);
        this.broker.invoke("actions:unregisterAction", { actionId }).catch((err) => console.warn("[ActionServiceProxy] unregisterAction failed:", err));
      }
      getActions(context) {
        console.warn("getActions called synchronously in proxy.");
        const allActions = extensionBridge.getActions();
        if (context) {
          return allActions.filter((a) => a.context === context);
        }
        return allActions;
      }
      executeAction(actionId) {
        return this.broker.invoke("actions:executeAction", { actionId });
      }
      setContext(context, data) {
        this.currentContext = context;
        this.broker.invoke("actions:setContext", { context, data }).catch((err) => console.warn("[ActionServiceProxy] setContext failed:", err));
      }
      getContext() {
        console.warn("getContext called synchronously in proxy.");
        return this.currentContext;
      }
      registerActionHandler(actionId, handler) {
        extensionBridge.registerActionHandler(this.extensionId, actionId, handler);
        this.broker.invoke("actions:registerActionHandler", { actionId }).catch((err) => console.warn("[ActionServiceProxy] registerActionHandler round-trip failed:", err));
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/SettingsServiceProxy.js
var __awaiter14, SettingsServiceProxy;
var init_SettingsServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/SettingsServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter14 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    SettingsServiceProxy = class extends BaseServiceProxy {
      get(section, key) {
        return __awaiter14(this, void 0, void 0, function* () {
          return this.broker.invoke("settings:get", { section, key });
        });
      }
      set(section, key, value) {
        return __awaiter14(this, void 0, void 0, function* () {
          return this.broker.invoke("settings:set", { section, key, value });
        });
      }
      onChanged(section, callback) {
        const handler = (e) => {
          var _a, _b;
          if (((_a = e.data) === null || _a === void 0 ? void 0 : _a.type) === "asyar:event:settingsChanged" && ((_b = e.data) === null || _b === void 0 ? void 0 : _b.section) === section) {
            callback(e.data.payload);
          }
        };
        window.addEventListener("message", handler);
        return () => {
          window.removeEventListener("message", handler);
        };
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/SearchBarAccessoryServiceProxy.js
var init_SearchBarAccessoryServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/SearchBarAccessoryServiceProxy.js"() {
    init_BaseServiceProxy();
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/EntitlementServiceProxy.js
var __awaiter15, EntitlementServiceProxy;
var init_EntitlementServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/EntitlementServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter15 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    EntitlementServiceProxy = class extends BaseServiceProxy {
      check(entitlement) {
        return __awaiter15(this, void 0, void 0, function* () {
          return this.broker.invoke("entitlements:check", { entitlement });
        });
      }
      getAll() {
        return __awaiter15(this, void 0, void 0, function* () {
          return this.broker.invoke("entitlements:getAll");
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/PreferencesServiceProxy.js
var PreferencesServiceProxy;
var init_PreferencesServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/PreferencesServiceProxy.js"() {
    init_BaseServiceProxy();
    PreferencesServiceProxy = class extends BaseServiceProxy {
      getAll() {
        return this.broker.invoke("preferences:getAll");
      }
      set(scope, key, value) {
        return this.broker.invoke("preferences:set", { scope, key, value });
      }
      reset(scope) {
        return this.broker.invoke("preferences:reset", { scope });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/FeedbackServiceProxy.js
var __awaiter16, FeedbackServiceProxy;
var init_FeedbackServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/FeedbackServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter16 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    FeedbackServiceProxy = class _FeedbackServiceProxy extends BaseServiceProxy {
      report(feedback) {
        return this.broker.invoke("feedback:report", { feedback });
      }
      showProgress(options) {
        return __awaiter16(this, void 0, void 0, function* () {
          const feedbackId = yield this.invoke("feedback:showProgress", { options });
          return {
            update: (update) => this.invoke("feedback:updateProgress", { feedbackId, update }),
            succeed: (title) => this.invoke("feedback:finishProgress", {
              feedbackId,
              outcome: { severity: "success", title }
            }),
            fail: (title, developerDetail) => this.invoke("feedback:finishProgress", {
              feedbackId,
              outcome: { severity: "error", title, developerDetail }
            }),
            dismiss: () => this.invoke("feedback:dismiss", { feedbackId })
          };
        });
      }
      announce(announcement) {
        return this.broker.invoke("feedback:announce", { announcement });
      }
      sendBackground(options) {
        return this.broker.invoke("feedback:sendBackground", { options });
      }
      dismissBackground(feedbackId) {
        return this.broker.invoke("feedback:dismissBackground", { feedbackId });
      }
      showHUD(title) {
        return this.broker.invoke("feedback:showHUD", { title });
      }
      confirmAlert(options) {
        return this.broker.invoke("feedback:confirmAlert", { options }, void 0, _FeedbackServiceProxy.CONFIRM_TIMEOUT_MS);
      }
    };
    FeedbackServiceProxy.CONFIRM_TIMEOUT_MS = 5 * 60 * 1e3;
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/SelectionServiceProxy.js
var SelectionServiceProxy;
var init_SelectionServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/SelectionServiceProxy.js"() {
    init_BaseServiceProxy();
    SelectionServiceProxy = class extends BaseServiceProxy {
      getSelectedText() {
        return this.broker.invoke("selection:getSelectedText", {}, void 0, 5e3);
      }
      getSelectedFinderItems() {
        return this.broker.invoke("selection:getSelectedFinderItems", {}, void 0, 5e3);
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/IShellService.js
var init_IShellService = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/IShellService.js"() {
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/OpenerServiceProxy.js
var __awaiter17, OpenerServiceProxy;
var init_OpenerServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/OpenerServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter17 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    OpenerServiceProxy = class extends BaseServiceProxy {
      openUrl(url) {
        return __awaiter17(this, void 0, void 0, function* () {
          return this.broker.invoke("opener:open", { url });
        });
      }
      openPath(path, options) {
        return __awaiter17(this, void 0, void 0, function* () {
          return this.broker.invoke("opener:openPath", { path, options });
        });
      }
      reveal(path) {
        return __awaiter17(this, void 0, void 0, function* () {
          return this.broker.invoke("opener:reveal", { path });
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/IInteropService.js
var init_IInteropService = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/IInteropService.js"() {
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/InteropServiceProxy.js
var __awaiter18, InteropServiceProxy;
var init_InteropServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/InteropServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter18 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    InteropServiceProxy = class extends BaseServiceProxy {
      launchCommand(extensionId2, commandId, args) {
        return __awaiter18(this, void 0, void 0, function* () {
          yield this.broker.invoke("interop:launchCommand", {
            extensionId: extensionId2,
            commandId,
            args: args !== null && args !== void 0 ? args : null
          });
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/WindowManagementService.js
var __awaiter19, WindowManagementServiceProxy;
var init_WindowManagementService = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/WindowManagementService.js"() {
    init_BaseServiceProxy();
    __awaiter19 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    WindowManagementServiceProxy = class extends BaseServiceProxy {
      getWindowBounds() {
        return __awaiter19(this, void 0, void 0, function* () {
          return this.broker.invoke("window:getWindowBounds");
        });
      }
      setWindowBounds(update) {
        return __awaiter19(this, void 0, void 0, function* () {
          return this.broker.invoke("window:setWindowBounds", {
            x: update.x,
            y: update.y,
            width: update.width,
            height: update.height
          });
        });
      }
      setFullscreen(enable) {
        return __awaiter19(this, void 0, void 0, function* () {
          return this.broker.invoke("window:setFullscreen", { enable });
        });
      }
      getMonitors() {
        return __awaiter19(this, void 0, void 0, function* () {
          return this.broker.invoke("window:getMonitors");
        });
      }
      applyPreset(presetId) {
        return __awaiter19(this, void 0, void 0, function* () {
          return this.broker.invoke("window:applyPreset", { presetId });
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/EnvironmentServiceProxy.js
var __awaiter20, EnvironmentServiceProxy;
var init_EnvironmentServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/EnvironmentServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter20 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    EnvironmentServiceProxy = class extends BaseServiceProxy {
      getEnvironment() {
        return __awaiter20(this, void 0, void 0, function* () {
          return this.broker.invoke("environment:getEnvironment");
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/index.js
var init_services = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/index.js"() {
    init_LogService();
    init_IClipboardHistoryService();
    init_IExtensionManager();
    init_ICommandService();
    init_ISettingsService();
    init_BaseServiceProxy();
    init_LogServiceProxy();
    init_ClipboardHistoryServiceProxy();
    init_ExtensionManagerProxy();
    init_CommandServiceProxy();
    init_ActionServiceProxy();
    init_NetworkServiceProxy();
    init_SettingsServiceProxy();
    init_StatusBarServiceProxy();
    init_SearchBarAccessoryServiceProxy();
    init_EntitlementServiceProxy();
    init_StorageServiceProxy();
    init_NotesServiceProxy();
    init_PreferencesServiceProxy();
    init_CacheServiceProxy();
    init_SearchServiceProxy();
    init_FeedbackServiceProxy();
    init_SelectionServiceProxy();
    init_OAuthServiceProxy();
    init_IShellService();
    init_ShellServiceProxy();
    init_FileManagerServiceProxy();
    init_OpenerServiceProxy();
    init_IInteropService();
    init_InteropServiceProxy();
    init_ApplicationService();
    init_WindowManagementService();
    init_PowerServiceProxy();
    init_ScreenServiceProxy();
    init_ProcessServiceProxy();
    init_SystemEventsServiceProxy();
    init_TimerServiceProxy();
    init_FileSystemWatcherService();
    init_EnvironmentServiceProxy();
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/ExtensionStateProxy.js
var __awaiter21, ExtensionStateProxy, extensionStateProxy;
var init_ExtensionStateProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/ExtensionStateProxy.js"() {
    init_BaseServiceProxy();
    __awaiter21 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    ExtensionStateProxy = class extends BaseServiceProxy {
      constructor() {
        super(...arguments);
        this.pushListenerInstalled = false;
        this.subs = /* @__PURE__ */ new Map();
        this.pagehideInstalled = false;
      }
      get(key) {
        return __awaiter21(this, void 0, void 0, function* () {
          return this.broker.invoke("state:get", { key });
        });
      }
      set(key, value) {
        return __awaiter21(this, void 0, void 0, function* () {
          yield this.broker.invoke("state:set", { key, value });
        });
      }
      /**
       * Register a subscriber for `(this-extension, key)` in the current role.
       * Returns a disposer that issues `state:unsubscribe` when called. The
       * disposer is idempotent — calling it twice is harmless.
       */
      subscribe(key, handler) {
        return __awaiter21(this, void 0, void 0, function* () {
          this.ensurePushListener();
          const role = this.resolveRole();
          const id = yield this.broker.invoke("state:subscribe", { key, role });
          this.subs.set(id, { id, key, handler });
          let disposed = false;
          return () => __awaiter21(this, void 0, void 0, function* () {
            if (disposed)
              return;
            disposed = true;
            this.subs.delete(id);
            try {
              yield this.broker.invoke("state:unsubscribe", { subscriptionId: id });
            } catch (_a) {
            }
          });
        });
      }
      /**
       * Install a one-shot `pagehide` listener on `window` that fires
       * `state:unsubscribe` for every active subscription. Called by the
       * view-side entry-point factory; worker-side projections skip this
       * because the worker iframe only unmounts on disable/uninstall and the
       * launcher's uninstall path calls `state:clear` which drops every
       * subscription server-side anyway.
       */
      installViewAutoUnsubscribe() {
        if (this.pagehideInstalled)
          return;
        this.pagehideInstalled = true;
        if (typeof window === "undefined")
          return;
        window.addEventListener("pagehide", () => {
          const snapshot = Array.from(this.subs.values());
          this.subs.clear();
          for (const s of snapshot) {
            this.broker.invoke("state:unsubscribe", { subscriptionId: s.id }).catch(() => {
            });
          }
        });
      }
      ensurePushListener() {
        if (this.pushListenerInstalled)
          return;
        this.pushListenerInstalled = true;
        this.broker.on("asyar:event:state:changed:push", (payload) => {
          if (!payload || typeof payload !== "object")
            return;
          const p = payload;
          if (typeof p.key !== "string")
            return;
          for (const s of this.subs.values()) {
            if (s.key !== p.key)
              continue;
            try {
              s.handler(p.value);
            } catch (_a) {
            }
          }
        });
      }
      resolveRole() {
        if (typeof window !== "undefined") {
          const injected = window.__ASYAR_ROLE__;
          if (injected === "worker" || injected === "view")
            return injected;
        }
        return "view";
      }
    };
    extensionStateProxy = new ExtensionStateProxy();
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/OnboardingServiceProxy.js
var __awaiter22, OnboardingServiceProxy;
var init_OnboardingServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/OnboardingServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter22 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    OnboardingServiceProxy = class extends BaseServiceProxy {
      complete() {
        return __awaiter22(this, void 0, void 0, function* () {
          return this.broker.invoke("onboarding:complete", {});
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/BrowserServiceProxy.js
var BrowserServiceProxy;
var init_BrowserServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/BrowserServiceProxy.js"() {
    init_BaseServiceProxy();
    BrowserServiceProxy = class extends BaseServiceProxy {
      constructor() {
        super(...arguments);
        this.states = /* @__PURE__ */ new Map();
        this.pushListenerInstalled = false;
      }
      listAvailableBrowsers() {
        return this.broker.invoke("browser:listAvailableBrowsers", {}, void 0, 5e3);
      }
      isCompanionInstalled(family) {
        return this.broker.invoke("browser:isCompanionInstalled", { family }, void 0, 5e3);
      }
      listBookmarks(filter) {
        return this.broker.invoke("browser:listBookmarks", { filter: filter !== null && filter !== void 0 ? filter : {} }, void 0, 5e3);
      }
      searchHistory(query, opts) {
        return this.broker.invoke("browser:searchHistory", { query, opts: opts !== null && opts !== void 0 ? opts : {} }, void 0, 5e3);
      }
      listTabs(filter) {
        return this.broker.invoke("browser:listTabs", { filter: filter !== null && filter !== void 0 ? filter : {} }, void 0, 5e3);
      }
      getActiveTab(browser) {
        return this.broker.invoke("browser:getActiveTab", { browser }, void 0, 5e3);
      }
      activateTab(tabId) {
        return this.broker.invoke("browser:activateTab", { tabId }, void 0, 5e3);
      }
      closeTab(tabId) {
        return this.broker.invoke("browser:closeTab", { tabId }, void 0, 5e3);
      }
      openUrl(url, target) {
        return this.broker.invoke("browser:openUrl", { url, target: target !== null && target !== void 0 ? target : {} }, void 0, 5e3);
      }
      listPairedBrowsers() {
        return this.broker.invoke("browser:listPairedBrowsers", {}, void 0, 5e3);
      }
      onTabsChanged(handler) {
        return this.subscribe("tabs.changed", "browser:subscribeTabsChanged", "browser:unsubscribeTabsChanged", handler);
      }
      onPageChanged(handler) {
        return this.subscribe("page.changed", "browser:subscribePageChanged", "browser:unsubscribePageChanged", handler);
      }
      subscribe(kind, subscribeMethod, unsubscribeMethod, handler) {
        this.ensurePushListener();
        let state = this.states.get(kind);
        if (!state) {
          const subscriptionIdPromise = this.broker.invoke(subscribeMethod, {}, void 0, 5e3);
          state = { subscriptionIdPromise, callbacks: /* @__PURE__ */ new Set() };
          this.states.set(kind, state);
        }
        const wrapped = (e) => handler(e);
        state.callbacks.add(wrapped);
        let disposed = false;
        return () => {
          if (disposed)
            return;
          disposed = true;
          const s = this.states.get(kind);
          if (!s)
            return;
          s.callbacks.delete(wrapped);
          if (s.callbacks.size === 0) {
            this.states.delete(kind);
            s.subscriptionIdPromise.then((id) => this.broker.invoke(unsubscribeMethod, { subscriptionId: id }, void 0, 5e3)).catch(() => {
            });
          }
        };
      }
      ensurePushListener() {
        if (this.pushListenerInstalled)
          return;
        this.pushListenerInstalled = true;
        this.broker.on("asyar:event:browser-event:push", (payload) => {
          if (!payload || typeof payload !== "object" || !("type" in payload))
            return;
          const env = payload;
          const kind = env.type === "tabs-changed" ? "tabs.changed" : env.type === "page-changed" ? "page.changed" : null;
          if (!kind)
            return;
          const state = this.states.get(kind);
          if (!state)
            return;
          for (const cb of state.callbacks) {
            try {
              cb(payload);
            } catch (_a) {
            }
          }
        });
      }
      // — Page content methods (Plan 3)
      getCurrentPage(browser) {
        return this.broker.invoke("browser:getCurrentPage", { browser }, void 0, 1e4);
      }
      queryPage(tabId, selector, attrs) {
        return this.broker.invoke("browser:queryPage", { tabId, selector, attrs }, void 0, 1e4);
      }
      actOnPage(tabId, action) {
        return this.broker.invoke("browser:actOnPage", { tabId, action }, void 0, 1e4);
      }
      // — Plan A (command-bar additions) —
      searchWeb(text, browser) {
        return this.broker.invoke("browser:searchWeb", { text, browser }, void 0, 5e3);
      }
      getMostRecentActiveBrowser() {
        return this.broker.invoke("browser:getMostRecentActiveBrowser", {}, void 0, 5e3);
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/FilesServiceProxy.js
var __awaiter23, FilesServiceProxy;
var init_FilesServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/FilesServiceProxy.js"() {
    init_BaseServiceProxy();
    __awaiter23 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    FilesServiceProxy = class extends BaseServiceProxy {
      search(query, opts) {
        return __awaiter23(this, void 0, void 0, function* () {
          return this.broker.invoke("files:search", { query, opts: opts !== null && opts !== void 0 ? opts : {} });
        });
      }
      status() {
        return __awaiter23(this, void 0, void 0, function* () {
          return this.broker.invoke("files:status", {});
        });
      }
      read(path, opts) {
        return __awaiter23(this, void 0, void 0, function* () {
          return this.broker.invoke("files:read", { path, opts: opts !== null && opts !== void 0 ? opts : {} });
        });
      }
      glob(pattern, opts) {
        return __awaiter23(this, void 0, void 0, function* () {
          return this.broker.invoke("files:glob", { pattern, opts: opts !== null && opts !== void 0 ? opts : {} });
        });
      }
      thumbnail(path, opts) {
        return __awaiter23(this, void 0, void 0, function* () {
          return this.broker.invoke("files:thumbnail", { path, opts: opts !== null && opts !== void 0 ? opts : {} });
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/ExtensionRpc.js
var __awaiter24, DEFAULT_TIMEOUT_MS, ExtensionRpc, extensionRpc;
var init_ExtensionRpc = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/ExtensionRpc.js"() {
    init_BaseServiceProxy();
    init_devInspectorBridge();
    __awaiter24 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    DEFAULT_TIMEOUT_MS = 5e3;
    ExtensionRpc = class extends BaseServiceProxy {
      constructor() {
        super(...arguments);
        this.pending = /* @__PURE__ */ new Map();
        this.viewListenerInstalled = false;
        this.pagehideInstalled = false;
        this.handlers = /* @__PURE__ */ new Map();
        this.inFlight = /* @__PURE__ */ new Map();
      }
      // ── view-side: request / abort ──────────────────────────────────────────
      /**
       * Send a request to this extension's worker. Resolves with the worker's
       * return value; rejects on worker-side throw, on host RPC error, or on
       * timeout (default 5000 ms, overridable via `opts.timeoutMs`).
       *
       * Generates a correlation id, enqueues via `state:rpcRequest`, stores a
       * pending-reply entry keyed by the id, starts a timer. Reply arrival
       * (via `asyar:event:state:rpc-reply:push`) resolves/rejects the entry
       * and cancels the timer. Timeout rejects, fires `state:rpcAbort` so the
       * worker handler's AbortSignal trips, and removes the entry so a stale
       * reply is silently dropped.
       */
      request(id, payload, opts) {
        return __awaiter24(this, void 0, void 0, function* () {
          var _a;
          this.ensureViewListener();
          const timeoutMs = (_a = opts === null || opts === void 0 ? void 0 : opts.timeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_TIMEOUT_MS;
          const correlationId = this.generateCorrelationId();
          const startedAt = Date.now();
          emitRpcLog({
            phase: "request",
            id,
            correlationId,
            payload,
            timeoutMs,
            timestamp: startedAt,
            extensionId: this.extensionId || void 0
          });
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              const entry = this.pending.get(correlationId);
              if (!entry || entry.settled)
                return;
              entry.settled = true;
              this.pending.delete(correlationId);
              emitRpcLog({
                phase: "timeout",
                id: entry.id,
                correlationId,
                elapsedMs: Date.now() - entry.startedAt,
                timestamp: Date.now(),
                extensionId: this.extensionId || void 0
              });
              this.broker.invoke("state:rpcAbort", { correlationId }).catch(() => {
              });
              reject(new Error(`RPC timeout after ${timeoutMs}ms for id=${id}`));
            }, timeoutMs);
            this.pending.set(correlationId, {
              resolve,
              reject,
              timer,
              settled: false,
              startedAt,
              id,
              timeoutMs
            });
            this.broker.invoke("state:rpcRequest", { id, correlationId, payload }).catch((err) => {
              const entry = this.pending.get(correlationId);
              if (!entry || entry.settled)
                return;
              entry.settled = true;
              clearTimeout(entry.timer);
              this.pending.delete(correlationId);
              const msg = err instanceof Error ? err.message : String(err);
              emitRpcLog({
                phase: "rejected",
                id: entry.id,
                correlationId,
                error: msg,
                elapsedMs: Date.now() - entry.startedAt,
                timestamp: Date.now(),
                extensionId: this.extensionId || void 0
              });
              reject(err instanceof Error ? err : new Error(String(err)));
            });
          });
        });
      }
      /**
       * Install the view-side `asyar:event:state:rpc-reply:push` listener.
       * Idempotent. Callers: the view-entry factory.
       */
      installViewMessageListener() {
        this.ensureViewListener();
      }
      /**
       * Install a `pagehide` listener that drops every pending reply so the
       * next view mount sees no zombie state. Stale replies arriving post-
       * pagehide are dropped silently.
       */
      installViewAutoCleanup() {
        if (this.pagehideInstalled)
          return;
        this.pagehideInstalled = true;
        if (typeof window === "undefined")
          return;
        window.addEventListener("pagehide", () => this.disposeAllPending());
      }
      /**
       * Clear every pending-reply entry. Exposed (not private) so tests can
       * trigger the same cleanup pagehide would run.
       */
      disposeAllPending() {
        for (const entry of this.pending.values()) {
          entry.settled = true;
          clearTimeout(entry.timer);
        }
        this.pending.clear();
      }
      ensureViewListener() {
        if (this.viewListenerInstalled)
          return;
        this.viewListenerInstalled = true;
        this.broker.on("asyar:event:state:rpc-reply:push", (payload) => {
          if (!payload || typeof payload !== "object")
            return;
          const p = payload;
          if (typeof p.correlationId !== "string")
            return;
          const entry = this.pending.get(p.correlationId);
          if (!entry || entry.settled)
            return;
          entry.settled = true;
          clearTimeout(entry.timer);
          this.pending.delete(p.correlationId);
          const elapsedMs = Date.now() - entry.startedAt;
          if (typeof p.error === "string") {
            emitRpcLog({
              phase: "rejected",
              id: entry.id,
              correlationId: p.correlationId,
              error: p.error,
              elapsedMs,
              timestamp: Date.now(),
              extensionId: this.extensionId || void 0
            });
            entry.reject(new Error(p.error));
          } else {
            emitRpcLog({
              phase: "resolved",
              id: entry.id,
              correlationId: p.correlationId,
              result: p.result,
              elapsedMs,
              timestamp: Date.now(),
              extensionId: this.extensionId || void 0
            });
            entry.resolve(p.result);
          }
        });
      }
      generateCorrelationId() {
        return Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15);
      }
      // ── worker-side: onRequest / delivery / abort ──────────────────────────
      /**
       * Register a handler for `id`. Overwrites any previous handler for the
       * same id; extensions that need fan-out can branch inside the handler.
       */
      onRequest(id, handler) {
        this.handlers.set(id, handler);
        return () => {
          if (this.handlers.get(id) === handler)
            this.handlers.delete(id);
        };
      }
      /**
       * Install the worker-side delivery shim. This method exists so tests can
       * trigger the listener installation explicitly; the worker entry-point
       * factory calls it once at bootstrap.
       *
       * The SDK inspects every `asyar:action:execute` message for a top-level
       * `__rpc__` discriminator and routes RPC envelopes here. The glue lives
       * in the worker entry factory (it has the `window` handle). This class
       * only exposes [`deliverActionPayload`] so the factory can feed one
       * payload at a time.
       */
      installWorkerMessageListener() {
      }
      /**
       * Test + factory entry: hand one `asyar:action:execute` payload to the
       * RPC dispatcher. Non-RPC payloads are ignored (the factory should not
       * call this for those; tests do).
       */
      deliverActionPayload(payload) {
        if (!payload || typeof payload !== "object")
          return;
        const p = payload;
        if (p.__rpc__ === "request") {
          if (typeof p.id !== "string" || typeof p.correlationId !== "string")
            return;
          this.dispatchRequest(p.id, p.correlationId, p.payload);
        } else if (p.__rpc__ === "abort") {
          if (typeof p.correlationId !== "string")
            return;
          this.dispatchAbort(p.correlationId);
        }
      }
      dispatchRequest(id, correlationId, payload) {
        const handler = this.handlers.get(id);
        if (!handler) {
          this.broker.invoke("state:rpcReply", {
            correlationId,
            error: `No handler registered for RPC id "${id}"`
          }).catch(() => {
          });
          return;
        }
        const controller = new AbortController();
        this.inFlight.set(correlationId, { controller });
        void (() => __awaiter24(this, void 0, void 0, function* () {
          try {
            const result = yield handler(payload, controller.signal);
            this.inFlight.delete(correlationId);
            yield this.broker.invoke("state:rpcReply", { correlationId, result }).catch(() => {
            });
          } catch (err) {
            this.inFlight.delete(correlationId);
            const msg = err instanceof Error ? err.message : String(err);
            yield this.broker.invoke("state:rpcReply", { correlationId, error: msg }).catch(() => {
            });
          }
        }))();
      }
      dispatchAbort(correlationId) {
        const h = this.inFlight.get(correlationId);
        if (!h)
          return;
        h.controller.abort();
        this.inFlight.delete(correlationId);
      }
    };
    extensionRpc = new ExtensionRpc();
  }
});

// ../../shim/node_modules/asyar-sdk/dist/PreferencesFacade.js
function buildFrozenSnapshot(bundle) {
  var _a;
  const snapshot = Object.assign(Object.assign({}, bundle.extension), { commands: {} });
  for (const [cmdId, prefs] of Object.entries((_a = bundle.commands) !== null && _a !== void 0 ? _a : {})) {
    snapshot.commands[cmdId] = Object.freeze(Object.assign({}, prefs));
  }
  Object.freeze(snapshot.commands);
  return Object.freeze(snapshot);
}
var __awaiter25, PreferencesFacade;
var init_PreferencesFacade = __esm({
  "../../shim/node_modules/asyar-sdk/dist/PreferencesFacade.js"() {
    init_PreferencesServiceProxy();
    __awaiter25 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    PreferencesFacade = class {
      constructor() {
        this.values = Object.freeze({
          commands: Object.freeze({})
        });
        this.proxy = new PreferencesServiceProxy();
      }
      /** @internal */
      _setValues(snapshot) {
        this.values = snapshot;
      }
      /** @internal */
      _setExtensionId(id) {
        this.proxy.setExtensionId(id);
      }
      set(scope, key, value) {
        return this.proxy.set(scope, key, value);
      }
      reset(scope) {
        return this.proxy.reset(scope);
      }
      refresh() {
        return __awaiter25(this, void 0, void 0, function* () {
          const fresh = yield this.proxy.getAll();
          this._setValues(buildFrozenSnapshot(fresh));
          return this.values;
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/lib/focusTracker.js
function setupFocusTracking() {
  if (typeof window === "undefined" || typeof document === "undefined")
    return;
  const isInput = (el) => {
    var _a;
    if (!el)
      return false;
    const tag = el.tagName.toLowerCase();
    if (tag === "textarea" || tag === "select")
      return true;
    if (tag === "input") {
      const type = ((_a = el.type) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || "text";
      const textTypes = [
        "text",
        "search",
        "email",
        "password",
        "number",
        "tel",
        "url",
        "date",
        "time",
        "datetime-local",
        "month",
        "week"
      ];
      return textTypes.includes(type);
    }
    if (el.isContentEditable)
      return true;
    return false;
  };
  let currentlyFocused = false;
  const emitFocus = (focused) => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "asyar:extension:input-focus", focused }, "*");
    }
  };
  document.addEventListener("focusin", (e) => {
    const active = isInput(e.target);
    if (active !== currentlyFocused) {
      currentlyFocused = active;
      emitFocus(currentlyFocused);
    }
  });
  document.addEventListener("focusout", () => {
    setTimeout(() => {
      const active = isInput(document.activeElement);
      if (active !== currentlyFocused) {
        currentlyFocused = active;
        emitFocus(currentlyFocused);
      }
    }, 0);
  });
}
var init_focusTracker = __esm({
  "../../shim/node_modules/asyar-sdk/dist/lib/focusTracker.js"() {
  }
});

// ../../shim/node_modules/asyar-sdk/dist/lib/themeInjector.js
function setupThemeInjection() {
  if (typeof window === "undefined" || typeof document === "undefined")
    return;
  window.addEventListener("message", (event) => {
    var _a, _b;
    if (((_a = event.data) === null || _a === void 0 ? void 0 : _a.type) === "asyar:theme:variables") {
      const vars = event.data.payload;
      if (!vars || typeof vars !== "object")
        return;
      injectThemeVariables(vars);
      return;
    }
    if (((_b = event.data) === null || _b === void 0 ? void 0 : _b.type) === "asyar:theme:fonts") {
      const css = event.data.payload;
      if (!css || typeof css !== "string")
        return;
      injectFontFaceCSS(css);
      return;
    }
  });
}
function injectThemeVariables(vars) {
  let style = document.getElementById("asyar-theme-vars");
  if (!style) {
    style = document.createElement("style");
    style.id = "asyar-theme-vars";
    document.head.appendChild(style);
  }
  const declarations = Object.entries(vars).map(([name, value]) => `  ${name}: ${value};`).join("\n");
  style.textContent = `:root {
${declarations}
}`;
}
function injectFontFaceCSS(css) {
  let style = document.getElementById("asyar-theme-fonts");
  if (!style) {
    style = document.createElement("style");
    style.id = "asyar-theme-fonts";
    document.head.appendChild(style);
  }
  style.textContent = css;
}
var init_themeInjector = __esm({
  "../../shim/node_modules/asyar-sdk/dist/lib/themeInjector.js"() {
  }
});

// ../../shim/node_modules/asyar-sdk/dist/lib/syncProviderBridge.js
function registerSyncProvider(extensionId2, provider) {
  var _a;
  if (typeof window !== "undefined" && window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: "asyar:sync:register",
      extensionId: extensionId2,
      payload: {
        displayName: provider.displayName,
        sensitiveFields: provider.sensitiveFields || [],
        defaultEnabled: (_a = provider.defaultEnabled) !== null && _a !== void 0 ? _a : true
      }
    }, "*");
  }
  if (typeof window !== "undefined") {
    window.addEventListener("message", (event) => __awaiter26(this, void 0, void 0, function* () {
      var _a2, _b, _c, _d, _e, _f;
      if (((_a2 = event.data) === null || _a2 === void 0 ? void 0 : _a2.type) === "asyar:sync:export" && ((_b = event.data) === null || _b === void 0 ? void 0 : _b.extensionId) === extensionId2) {
        try {
          const data = yield provider.export();
          window.parent.postMessage({
            type: "asyar:sync:export:response",
            extensionId: extensionId2,
            messageId: event.data.messageId,
            payload: data,
            success: true
          }, "*");
        } catch (err) {
          window.parent.postMessage({
            type: "asyar:sync:export:response",
            extensionId: extensionId2,
            messageId: event.data.messageId,
            success: false,
            error: String(err)
          }, "*");
        }
      }
      if (((_c = event.data) === null || _c === void 0 ? void 0 : _c.type) === "asyar:sync:import" && ((_d = event.data) === null || _d === void 0 ? void 0 : _d.extensionId) === extensionId2) {
        try {
          yield provider.import(event.data.payload.data, event.data.payload.strategy);
          window.parent.postMessage({
            type: "asyar:sync:import:response",
            extensionId: extensionId2,
            messageId: event.data.messageId,
            success: true
          }, "*");
        } catch (err) {
          window.parent.postMessage({
            type: "asyar:sync:import:response",
            extensionId: extensionId2,
            messageId: event.data.messageId,
            success: false,
            error: String(err)
          }, "*");
        }
      }
      if (((_e = event.data) === null || _e === void 0 ? void 0 : _e.type) === "asyar:sync:preview" && ((_f = event.data) === null || _f === void 0 ? void 0 : _f.extensionId) === extensionId2) {
        try {
          const result = yield provider.preview(event.data.payload.data);
          window.parent.postMessage({
            type: "asyar:sync:preview:response",
            extensionId: extensionId2,
            messageId: event.data.messageId,
            payload: result,
            success: true
          }, "*");
        } catch (err) {
          window.parent.postMessage({
            type: "asyar:sync:preview:response",
            extensionId: extensionId2,
            messageId: event.data.messageId,
            success: false,
            error: String(err)
          }, "*");
        }
      }
    }));
  }
}
var __awaiter26;
var init_syncProviderBridge = __esm({
  "../../shim/node_modules/asyar-sdk/dist/lib/syncProviderBridge.js"() {
    __awaiter26 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/ExtensionContextCore.js
var ExtensionContextCore;
var init_ExtensionContextCore = __esm({
  "../../shim/node_modules/asyar-sdk/dist/ExtensionContextCore.js"() {
    init_PreferencesFacade();
    init_syncProviderBridge();
    ExtensionContextCore = class {
      constructor(init) {
        this.extensionId = "";
        this.preferences = new PreferencesFacade();
        this.preferenceChangeListeners = [];
        this.role = init.role;
        this.proxies = init.proxies;
      }
      setPreferences(bundle) {
        this.preferences._setValues(buildFrozenSnapshot(bundle));
        for (const cb of this.preferenceChangeListeners) {
          try {
            cb();
          } catch (err) {
            console.error("[ExtensionContext] onPreferencesChanged listener threw:", err);
          }
        }
      }
      onPreferencesChanged(callback) {
        this.preferenceChangeListeners.push(callback);
        return () => {
          this.preferenceChangeListeners = this.preferenceChangeListeners.filter((l) => l !== callback);
        };
      }
      getService(namespace) {
        const service = this.proxies[namespace];
        if (!service) {
          throw new Error(`Service "${namespace}" not registered`);
        }
        return service;
      }
      setExtensionId(id) {
        this.extensionId = id;
        for (const key of Object.keys(this.proxies)) {
          const svc = this.proxies[key];
          if (svc && typeof svc.setExtensionId === "function") {
            svc.setExtensionId(id);
          }
        }
        this.preferences._setExtensionId(id);
        this.notifyRpcIfAvailable(id);
        this.notifyBridgeIfAvailable(id);
        this.emitLoadedEvent(id);
      }
      notifyBridgeIfAvailable(_id) {
      }
      notifyRpcIfAvailable(_id) {
      }
      emitLoadedEvent(id) {
        try {
          if (typeof window !== "undefined" && window.parent && window.parent !== window && typeof window.parent.postMessage === "function") {
            const role = this.resolveRuntimeRole();
            window.parent.postMessage({ type: "asyar:extension:loaded", extensionId: id, role }, "*");
          }
        } catch (_a) {
        }
      }
      resolveRuntimeRole() {
        if (typeof window !== "undefined") {
          const injected = window.__ASYAR_ROLE__;
          if (injected === "worker" || injected === "view")
            return injected;
        }
        return this.role;
      }
      registerAction(action) {
        if (!this.extensionId) {
          console.error("Cannot register action: Extension ID not set");
          return;
        }
        const actions = this.proxies.actions;
        if (!actions) {
          throw new Error("actions service not available in this context");
        }
        actions.registerAction(action);
      }
      unregisterAction(actionId) {
        const actions = this.proxies.actions;
        if (!actions)
          return;
        actions.unregisterAction(actionId);
      }
      registerCommand(commandId, handler) {
        if (!this.extensionId) {
          console.error("Cannot register command: Extension ID not set");
          return;
        }
        const fullCommandId = `${this.extensionId}.${commandId}`;
        const commands = this.proxies.commands;
        if (!commands) {
          throw new Error("commands service not available in this context");
        }
        commands.registerCommand(fullCommandId, handler, this.extensionId);
      }
      unregisterCommand(commandId) {
        const fullCommandId = `${this.extensionId}.${commandId}`;
        const commands = this.proxies.commands;
        if (!commands)
          return;
        commands.unregisterCommand(fullCommandId);
      }
      createDeeplink(commandId, args) {
        if (!this.extensionId) {
          throw new Error("Cannot create deeplink: Extension ID not set");
        }
        let url = `asyar://extensions/${encodeURIComponent(this.extensionId)}/${encodeURIComponent(commandId)}`;
        if (args && Object.keys(args).length > 0) {
          const params = new URLSearchParams(args).toString();
          url += `?${params}`;
        }
        return url;
      }
      registerSyncProvider(provider) {
        if (!this.extensionId) {
          console.error("Cannot register sync provider: Extension ID not set");
          return;
        }
        registerSyncProvider(this.extensionId, provider);
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/ExtensionContext.js
var ExtensionContext_exports = {};
__export(ExtensionContext_exports, {
  ExtensionContext: () => ExtensionContext,
  ExtensionContextCore: () => ExtensionContextCore,
  PreferencesFacade: () => PreferencesFacade,
  injectFontFaceCSS: () => injectFontFaceCSS,
  injectThemeVariables: () => injectThemeVariables
});
function buildFullProxyBag() {
  return {
    log: new LogServiceProxy(),
    clipboard: new ClipboardHistoryServiceProxy(),
    extensions: new ExtensionManagerProxy(),
    commands: new CommandServiceProxy(),
    actions: new ActionServiceProxy(),
    network: new NetworkServiceProxy(),
    settings: new SettingsServiceProxy(),
    statusBar: new StatusBarServiceProxy(),
    entitlements: new EntitlementServiceProxy(),
    storage: new StorageServiceProxy(),
    notes: new NotesServiceProxy(),
    feedback: new FeedbackServiceProxy(),
    selection: new SelectionServiceProxy(),
    oauth: new OAuthServiceProxy(),
    shell: new ShellServiceProxy(),
    fs: new FileManagerServiceProxy(),
    interop: new InteropServiceProxy(),
    cache: new CacheServiceProxy(),
    search: new SearchServiceProxy(),
    application: new ApplicationServiceProxy(),
    window: new WindowManagementServiceProxy(),
    opener: new OpenerServiceProxy(),
    power: new PowerServiceProxy(),
    screen: new ScreenServiceProxy(),
    process: new ProcessServiceProxy(),
    systemEvents: new SystemEventsServiceProxy(),
    timers: new TimerServiceProxy(),
    state: new ExtensionStateProxy(),
    onboarding: new OnboardingServiceProxy(),
    browser: new BrowserServiceProxy(),
    files: new FilesServiceProxy(),
    environment: new EnvironmentServiceProxy()
  };
}
var ExtensionContext;
var init_ExtensionContext = __esm({
  "../../shim/node_modules/asyar-sdk/dist/ExtensionContext.js"() {
    init_services();
    init_OAuthServiceProxy();
    init_FileManagerServiceProxy();
    init_InteropServiceProxy();
    init_WindowManagementService();
    init_PowerServiceProxy();
    init_ScreenServiceProxy();
    init_ProcessServiceProxy();
    init_SystemEventsServiceProxy();
    init_TimerServiceProxy();
    init_ExtensionStateProxy();
    init_OnboardingServiceProxy();
    init_BrowserServiceProxy();
    init_FilesServiceProxy();
    init_OpenerServiceProxy();
    init_EnvironmentServiceProxy();
    init_ExtensionRpc();
    init_PreferencesFacade();
    init_focusTracker();
    init_themeInjector();
    init_themeInjector();
    init_ExtensionContextCore();
    init_ExtensionContextCore();
    init_ExtensionBridge();
    ExtensionContext = class extends ExtensionContextCore {
      constructor() {
        super({ role: "view", proxies: buildFullProxyBag() });
        setupFocusTracking();
        setupThemeInjection();
        if (typeof window !== "undefined" && window.parent !== window) {
          window.addEventListener("error", (e) => {
            var _a, _b;
            window.parent.postMessage({
              type: "asyar:feedback:uncaught",
              payload: {
                kind: "iframe_uncaught",
                developerDetail: (_b = (_a = e.error) === null || _a === void 0 ? void 0 : _a.stack) !== null && _b !== void 0 ? _b : String(e.message)
              }
            }, "*");
          });
          window.addEventListener("unhandledrejection", (e) => {
            window.parent.postMessage({
              type: "asyar:feedback:uncaught",
              payload: {
                kind: "iframe_unhandled_rejection",
                developerDetail: String(e.reason)
              }
            }, "*");
          });
        }
        extensionRpc.installViewMessageListener();
        extensionRpc.installViewAutoCleanup();
        const stateProxy = this.proxies.state;
        stateProxy === null || stateProxy === void 0 ? void 0 : stateProxy.installViewAutoUnsubscribe();
      }
      /**
       * View-side RPC entry. Sends a request into this extension's worker and
       * awaits the worker handler's reply. Default 5s timeout, overridable via
       * `opts.timeoutMs`. See `ExtensionRpc.request` for the AbortSignal +
       * stale-reply contract.
       */
      request(id, payload, opts) {
        return extensionRpc.request(id, payload, opts);
      }
      notifyRpcIfAvailable(id) {
        extensionRpc.setExtensionId(id);
      }
      /**
       * Hide the Asyar launcher window. Self-scoped UI affordance (no permission
       * required — same class as dismissing via Esc). Fire-and-forget; safe to
       * call from a view after completing a user action.
       */
      hideLauncher() {
        if (typeof window !== "undefined" && window.parent !== window) {
          window.parent.postMessage({ type: "asyar:window:hide" }, "*");
        }
      }
      notifyBridgeIfAvailable(id) {
        try {
          extensionBridge.registerActiveContext(id, this);
        } catch (_a) {
        }
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/ExtensionBridge.js
function toFullActionId(extensionId2, actionId) {
  const prefix = `act_${extensionId2}_`;
  return actionId.startsWith(prefix) ? actionId : `${prefix}${actionId}`;
}
var __awaiter27, ExtensionBridge, extensionBridge;
var init_ExtensionBridge = __esm({
  "../../shim/node_modules/asyar-sdk/dist/ExtensionBridge.js"() {
    init_MessageBroker();
    __awaiter27 = function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    ExtensionBridge = class {
      constructor() {
        this.extensionManifests = /* @__PURE__ */ new Map();
        this.extensionImplementations = /* @__PURE__ */ new Map();
        this.actionRegistry = /* @__PURE__ */ new Map();
        this.commandRegistry = /* @__PURE__ */ new Map();
        this.preferences = /* @__PURE__ */ new Map();
        this.activeContexts = /* @__PURE__ */ new Map();
        this.broker = messageBroker;
        this.setupIPCListeners();
        this.installNavigationKeyForwarder();
        console.debug("[asyar-sdk] ExtensionBridge instance created");
      }
      /**
       * Forward host-reserved keys from inside the iframe back to the host.
       * Iframe keystrokes don't propagate to the parent window natively, so
       * without this the host never sees Escape, Cmd/Ctrl+K, etc. — the
       * launcher's navigation and action-panel become unreachable whenever
       * the iframe has focus.
       *
       * Two classes are forwarded:
       *  - Modifier combos (Cmd/Ctrl+K, Cmd/Ctrl+,, Cmd/Ctrl+Q) — unconditional;
       *    no conflict with typing.
       *  - Escape and Backspace — only when no text field is focused, so
       *    users can still edit form inputs inside the extension.
       */
      installNavigationKeyForwarder() {
        if (typeof window === "undefined")
          return;
        const isEditableTarget = () => {
          var _a;
          const el = document.activeElement;
          if (!el)
            return false;
          const tag = (_a = el.tagName) === null || _a === void 0 ? void 0 : _a.toLowerCase();
          return tag === "input" || tag === "textarea" || el.isContentEditable;
        };
        const forward = (event) => {
          event.preventDefault();
          window.parent.postMessage({
            type: "asyar:extension:keydown",
            payload: {
              key: event.key,
              metaKey: event.metaKey,
              ctrlKey: event.ctrlKey,
              shiftKey: event.shiftKey,
              altKey: event.altKey
            }
          }, "*");
        };
        window.addEventListener("keydown", (event) => {
          const isModifierCombo = event.metaKey || event.ctrlKey;
          const lowerKey = event.key.toLowerCase();
          if (isModifierCombo && (lowerKey === "k" || lowerKey === "," || lowerKey === "q")) {
            forward(event);
            return;
          }
          if ((event.key === "Escape" || event.key === "Backspace") && !isEditableTarget()) {
            forward(event);
          }
        });
      }
      setupIPCListeners() {
        this.broker.on("asyar:invoke:command", (raw) => __awaiter27(this, void 0, void 0, function* () {
          const data = raw;
          try {
            const result = yield this.executeCommand(data.payload.commandId, data.payload.args);
            this.broker.send({
              type: "asyar:response",
              messageId: data.messageId,
              result
            });
          } catch (err) {
            this.broker.send({
              type: "asyar:response",
              messageId: data.messageId,
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }));
        this.broker.on("asyar:event:preferences:set-all", (raw) => {
          var _a, _b;
          const payload = raw;
          const bundle = {
            extension: (_a = payload === null || payload === void 0 ? void 0 : payload.extension) !== null && _a !== void 0 ? _a : {},
            commands: (_b = payload === null || payload === void 0 ? void 0 : payload.commands) !== null && _b !== void 0 ? _b : {}
          };
          for (const [id, context] of this.activeContexts) {
            this.preferences.set(id, bundle);
            context.setPreferences(bundle);
          }
          if (this.activeContexts.size === 0) {
            this.preferences.set("__pending__", bundle);
          }
        });
        if (typeof window !== "undefined") {
          window.addEventListener("message", (event) => __awaiter27(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            if (event.source !== window.parent)
              return;
            const data = event.data;
            if (!data || typeof data !== "object")
              return;
            if (data.type === "asyar:action:execute") {
              const actionId = (_a = data.payload) === null || _a === void 0 ? void 0 : _a.actionId;
              if (actionId) {
                const action = this.actionRegistry.get(actionId);
                if (action === null || action === void 0 ? void 0 : action.execute) {
                  const actionPayload = (_b = data.payload) === null || _b === void 0 ? void 0 : _b.actionPayload;
                  Promise.resolve(action.execute(actionPayload)).catch((err) => console.error("[asyar-sdk] action execute failed:", err));
                }
              }
              return;
            }
            if (data.type === "asyar:command:execute") {
              const { commandId, args } = data.payload;
              for (const extension of this.extensionImplementations.values()) {
                if (typeof extension.executeCommand === "function") {
                  Promise.resolve(extension.executeCommand(commandId, args)).catch((err) => console.error("[asyar-sdk] command execute failed:", err));
                }
              }
              return;
            }
            if (data.type !== "asyar:search:request")
              return;
            const { messageId, payload } = data;
            const query = (_c = payload === null || payload === void 0 ? void 0 : payload.query) !== null && _c !== void 0 ? _c : "";
            try {
              let results = [];
              for (const extension of this.extensionImplementations.values()) {
                if (extension.search) {
                  const extResults = (_d = yield extension.search(query)) !== null && _d !== void 0 ? _d : [];
                  results = [
                    ...results,
                    ...extResults.map((r) => {
                      var _a2;
                      return {
                        title: r.title,
                        subtitle: r.subtitle,
                        score: (_a2 = r.score) !== null && _a2 !== void 0 ? _a2 : 0.5,
                        icon: r.icon,
                        type: r.type,
                        style: r.style,
                        viewPath: r.viewPath,
                        actionId: r.actionId,
                        actionPayload: r.actionPayload
                        // Do NOT send `action` — functions can't be serialized via postMessage
                      };
                    })
                  ];
                }
              }
              window.parent.postMessage({
                type: "asyar:search:response",
                messageId,
                result: results
              }, "*");
            } catch (error) {
              window.parent.postMessage({
                type: "asyar:search:response",
                messageId,
                error: error instanceof Error ? error.message : String(error)
              }, "*");
            }
          }));
        }
      }
      // Register a service implementation from the base app
      registerService(serviceType, _implementation) {
        console.warn(`[asyar-sdk] registerService is deprecated. Service ${serviceType} is now proxied.`);
      }
      // Component proxying has been removed in the new architecture.
      // Extensions should bundle their own components.
      // Register an action from an extension
      registerAction(extensionId2, action) {
        const actionId = action.id;
        this.actionRegistry.set(actionId, Object.assign(Object.assign({}, action), { id: actionId, extensionId: extensionId2 }));
        console.debug(`[asyar-sdk] Registered action: ${actionId}`);
      }
      // Unregister an action
      unregisterAction(actionId) {
        this.actionRegistry.delete(actionId);
      }
      // Get all registered actions
      getActions() {
        return Array.from(this.actionRegistry.values());
      }
      /**
       * Register a handler for a manifest-declared action.
       * Stores the handler locally in the actionRegistry so the
       * asyar:action:execute message from the host can find it.
       * No IPC message sent — the host already knows about the action from the manifest.
       */
      registerActionHandler(extensionId2, actionId, handler) {
        const fullActionId = toFullActionId(extensionId2, actionId);
        this.actionRegistry.set(fullActionId, {
          id: fullActionId,
          title: actionId,
          extensionId: extensionId2,
          execute: handler
        });
        console.debug(`[asyar-sdk] Registered action handler: ${fullActionId}`);
      }
      /**
       * Register a live `ExtensionContext` with the bridge as the active
       * context for an extension id. This is what lets the
       * `asyar:event:preferences:set-all` listener find the context and
       * call `setPreferences` on it.
       *
       * Tier 2 iframes that bootstrap by creating their own
       * `ExtensionContext` (instead of going through the bridge's
       * `initializeExtensions()` path) must call this so they show up in
       * `activeContexts`. Otherwise the preferences bundle arrives at the
       * bridge but never reaches the live context — it only lands in the
       * `this.preferences` map which is consulted by `initializeExtensions`.
       *
       * Called from `ExtensionContext.setExtensionId`, so Tier 2 iframes get
       * this for free as long as they call `setExtensionId(id)` during boot.
       */
      registerActiveContext(extensionId2, context) {
        var _a;
        this.activeContexts.set(extensionId2, context);
        const existing = (_a = this.preferences.get(extensionId2)) !== null && _a !== void 0 ? _a : this.preferences.get("__pending__");
        if (existing) {
          context.setPreferences(existing);
          this.preferences.set(extensionId2, existing);
          this.preferences.delete("__pending__");
        }
      }
      /**
       * Store a preference bundle (extension-level + command-level) for an
       * extension. Called by the host-side ExtensionLoader before the extension
       * is initialized, so that `initializeExtensions` can hand it to the new
       * ExtensionContext as a frozen snapshot.
       */
      setPreferences(extensionId2, bundle) {
        this.preferences.set(extensionId2, bundle);
      }
      // Register an extension manifest
      registerManifest(manifest) {
        this.extensionManifests.set(manifest.id, manifest);
        console.debug(`[asyar-sdk] Registered extension manifest: ${manifest.id} (${manifest.name} v${manifest.version})`);
      }
      // Register extension implementation
      registerExtensionImplementation(id, extension) {
        if (!this.extensionManifests.has(id)) {
          console.error(`[asyar-sdk] Cannot register extension implementation: Manifest for ${id} not found`);
          return;
        }
        this.extensionImplementations.set(id, extension);
        console.debug(`[asyar-sdk] Registered extension implementation for: ${id}`);
      }
      // Initialize all registered extensions
      initializeExtensions() {
        return __awaiter27(this, void 0, void 0, function* () {
          for (const [id, extension] of this.extensionImplementations.entries()) {
            const manifest = this.extensionManifests.get(id);
            if (!manifest) {
              console.error(`[asyar-sdk] Cannot initialize extension: Manifest for ${id} not found`);
              continue;
            }
            console.debug(`[asyar-sdk] Initializing extension: ${manifest.id} (${manifest.name})`);
            const { ExtensionContext: ExtensionContext3 } = yield Promise.resolve().then(() => (init_ExtensionContext(), ExtensionContext_exports));
            const context = new ExtensionContext3();
            context.setExtensionId(manifest.id);
            try {
              yield extension.initialize(context);
            } catch (error) {
              console.error(`[asyar-sdk] Failed to initialize extension ${manifest.id}: ${error}`);
            }
          }
        });
      }
      // Activate all registered extensions
      activateExtensions() {
        return __awaiter27(this, void 0, void 0, function* () {
          for (const [id, extension] of this.extensionImplementations.entries()) {
            const manifest = this.extensionManifests.get(id);
            if (!manifest)
              continue;
            console.debug(`[asyar-sdk] Activating extension: ${manifest.id}`);
            try {
              yield extension.activate();
            } catch (error) {
              console.error(`[asyar-sdk] Failed to activate extension ${manifest.id}: ${error}`);
            }
          }
        });
      }
      // Deactivate all registered extensions. Each deactivate() is time-boxed —
      // the host awaits this call in its unload/reload pipeline, so one
      // extension that never settles would wedge every extension reload.
      // Returns the ids that failed or timed out so the host can log them.
      deactivateExtensions() {
        return __awaiter27(this, void 0, void 0, function* () {
          const failed = [];
          for (const [id, extension] of this.extensionImplementations.entries()) {
            const manifest = this.extensionManifests.get(id);
            if (!manifest)
              continue;
            console.debug(`[asyar-sdk] Deactivating extension: ${manifest.id}`);
            let timer;
            try {
              yield Promise.race([
                Promise.resolve(extension.deactivate()),
                new Promise((_, reject) => {
                  timer = setTimeout(() => reject(new Error("deactivate() timed out after 5000ms")), 5e3);
                })
              ]);
            } catch (error) {
              console.error(`[asyar-sdk] Failed to deactivate extension ${manifest.id}: ${error}`);
              failed.push(manifest.id);
            } finally {
              clearTimeout(timer);
            }
          }
          return failed;
        });
      }
      // Get all registered extension manifests
      getManifests() {
        return Array.from(this.extensionManifests.values());
      }
      // Get manifest by extension ID
      getManifest(id) {
        return this.extensionManifests.get(id);
      }
      // Get extension implementation by ID
      getExtensionImplementation(id) {
        return this.extensionImplementations.get(id);
      }
      // Register a command from an extension
      registerCommand(commandId, handler, extensionId2) {
        this.commandRegistry.set(commandId, { handler, extensionId: extensionId2 });
        console.debug(`[asyar-sdk] Registered command: ${commandId}`);
      }
      // Unregister a command
      unregisterCommand(commandId) {
        this.commandRegistry.delete(commandId);
      }
      // Execute a command
      executeCommand(commandId, args) {
        return __awaiter27(this, void 0, void 0, function* () {
          const command = this.commandRegistry.get(commandId);
          if (!command) {
            throw new Error(`Command not found: ${commandId}`);
          }
          return command.handler.execute(args);
        });
      }
      // Get all registered commands
      getCommands() {
        return Array.from(this.commandRegistry.keys());
      }
      // Get commands for a specific extension
      getCommandsForExtension(extensionId2) {
        return Array.from(this.commandRegistry.entries()).filter(([_, value]) => value.extensionId === extensionId2).map(([key, _]) => key);
      }
    };
    extensionBridge = new ExtensionBridge();
  }
});

// ../../shim/node_modules/asyar-sdk/dist/services/CommandServiceProxy.js
var CommandServiceProxy;
var init_CommandServiceProxy = __esm({
  "../../shim/node_modules/asyar-sdk/dist/services/CommandServiceProxy.js"() {
    init_BaseServiceProxy();
    init_ExtensionBridge();
    CommandServiceProxy = class extends BaseServiceProxy {
      registerCommand(commandId, handler, extensionId2, actions) {
        extensionBridge.registerCommand(commandId, handler, extensionId2);
        this.broker.invoke("commands:registerCommand", { commandId, extensionId: extensionId2, actions }).catch((err) => console.warn("[CommandServiceProxy] registerCommand failed:", err));
      }
      unregisterCommand(commandId) {
        extensionBridge.unregisterCommand(commandId);
        this.broker.invoke("commands:unregisterCommand", { commandId }).catch((err) => console.warn("[CommandServiceProxy] unregisterCommand failed:", err));
      }
      executeCommand(commandId, args) {
        return this.broker.invoke("commands:executeCommand", { commandId, args });
      }
      getCommands() {
        console.warn("getCommands called synchronously in proxy.");
        return extensionBridge.getCommands();
      }
      getCommandsForExtension(extensionId2) {
        console.warn("getCommandsForExtension called synchronously in proxy.");
        return extensionBridge.getCommandsForExtension(extensionId2);
      }
      clearCommandsForExtension(extensionId2) {
        this.broker.invoke("commands:clearCommandsForExtension", { extensionId: extensionId2 }).catch((err) => console.warn("[CommandServiceProxy] clearCommandsForExtension failed:", err));
      }
      updateCommandMetadata(commandId, metadata) {
        var _a;
        return this.broker.invoke("commands:updateCommandMetadata", {
          extensionId: this.extensionId,
          commandId,
          subtitle: (_a = metadata.subtitle) !== null && _a !== void 0 ? _a : null
        });
      }
      /**
       * Replace this extension's dynamic command list with the given set.
       *
       * Worker-only — the underlying data source (file watcher, OS listing,
       * remote API) lives in the worker so it can fire while the view is
       * Dormant. The runtime guard below mirrors the architectural
       * constraint: registering from the view iframe would silently lose
       * commands across panel-close cycles. Re-asserting the role at the
       * call site means the constraint holds even if a future extension
       * mis-imports the proxy.
       */
      replaceDynamicCommands(regs) {
        if (typeof window === "undefined" || window.__ASYAR_ROLE__ !== "worker") {
          return Promise.reject(new Error("[CommandServiceProxy] replaceDynamicCommands is worker-only. Call this from your extension's worker.ts, not view.ts. Dynamic command lists must survive view eviction (Dormant), so registration must live with the always-on worker context."));
        }
        return this.broker.invoke("commands:replaceDynamicCommands", {
          extensionId: this.extensionId,
          regs
        });
      }
    };
  }
});

// ../../shim/node_modules/asyar-sdk/dist/worker.js
init_LogServiceProxy();
init_StorageServiceProxy();
init_NotesServiceProxy();
init_CacheServiceProxy();
init_SearchServiceProxy();
init_NetworkServiceProxy();
init_ShellServiceProxy();
init_OAuthServiceProxy();
init_FileManagerServiceProxy();
init_ApplicationService();
init_PowerServiceProxy();
init_ScreenServiceProxy();
init_ProcessServiceProxy();
init_SystemEventsServiceProxy();
init_TimerServiceProxy();
init_FileSystemWatcherService();
init_StatusBarServiceProxy();
init_CommandServiceProxy();
init_ExtensionStateProxy();
init_ActionServiceProxy();
init_FeedbackServiceProxy();
init_OnboardingServiceProxy();

// ../../shim/node_modules/asyar-sdk/dist/services/RunServiceProxy.js
init_BaseServiceProxy();
var __awaiter28 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var CANCEL_EVENT = "asyar:event:runs:cancel";
var RunServiceProxy = class extends BaseServiceProxy {
  /** Start a new run and return a handle for writing output and signalling completion. */
  start(input) {
    return __awaiter28(this, void 0, void 0, function* () {
      var _a;
      const id = crypto.randomUUID();
      const kind = input.kind;
      const label = input.label;
      const cancellable = (_a = input.cancellable) !== null && _a !== void 0 ? _a : false;
      yield this.invoke("runs:start", { id, kind, label, cancellable });
      return this.buildHandle(id);
    });
  }
  buildHandle(id) {
    const invoke = this.invoke.bind(this);
    const broker = this.broker;
    let cancelled = false;
    const callbacks = /* @__PURE__ */ new Set();
    const handler = (payload) => {
      const p = payload;
      if ((p === null || p === void 0 ? void 0 : p.id) !== id)
        return;
      cancelled = true;
      for (const cb of callbacks)
        cb();
      broker.off(CANCEL_EVENT, handler);
    };
    broker.on(CANCEL_EVENT, handler);
    const unsubscribeAll = () => {
      broker.off(CANCEL_EVENT, handler);
    };
    return {
      get id() {
        return id;
      },
      get cancelled() {
        return cancelled;
      },
      /** Write a line of output to this run. */
      write(line) {
        return __awaiter28(this, void 0, void 0, function* () {
          yield invoke("runs:write", { id, line });
        });
      },
      /** Signal that the run completed successfully. */
      done() {
        return __awaiter28(this, void 0, void 0, function* () {
          yield invoke("runs:done", { id });
          unsubscribeAll();
        });
      },
      /** Signal that the run failed with the given error message. */
      fail(error) {
        return __awaiter28(this, void 0, void 0, function* () {
          yield invoke("runs:fail", { id, error });
          unsubscribeAll();
        });
      },
      /** Request cancellation of this run. */
      cancel() {
        return __awaiter28(this, void 0, void 0, function* () {
          try {
            yield invoke("runs:cancel", { id });
          } finally {
            unsubscribeAll();
          }
        });
      },
      /** Register a callback that fires when this run is cancelled. Returns an unsubscribe function. */
      onCancel(cb) {
        callbacks.add(cb);
        return () => {
          callbacks.delete(cb);
        };
      }
    };
  }
};

// ../../shim/node_modules/asyar-sdk/dist/services/ToolsServiceProxy.js
init_BaseServiceProxy();
var __awaiter29 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var ToolsServiceProxy = class extends BaseServiceProxy {
  constructor() {
    super(...arguments);
    this.handlers = /* @__PURE__ */ new Map();
  }
  registerTool(tool, handler) {
    return __awaiter29(this, void 0, void 0, function* () {
      this.handlers.set(tool.id, handler);
      return this.broker.invoke("tools:registerTool", { tool });
    });
  }
  unregisterTool(id) {
    return __awaiter29(this, void 0, void 0, function* () {
      const result = yield this.broker.invoke("tools:unregisterTool", { id });
      this.handlers.delete(id);
      return result;
    });
  }
  listTools() {
    return __awaiter29(this, void 0, void 0, function* () {
      return this.broker.invoke("tools:listTools");
    });
  }
  invokeHandler(id, args) {
    return __awaiter29(this, void 0, void 0, function* () {
      if (typeof id !== "string" || !this.handlers.has(id)) {
        throw new Error(`[asyar-sdk/tools] No handler registered for tool id: "${id}"`);
      }
      const handler = this.handlers.get(id);
      if (typeof handler !== "function") {
        throw new Error(`[asyar-sdk/tools] Invalid handler registered for tool id: "${id}"`);
      }
      return handler(args);
    });
  }
};

// ../../shim/node_modules/asyar-sdk/dist/services/SnippetsServiceProxy.js
init_BaseServiceProxy();

// ../../shim/node_modules/asyar-sdk/dist/contracts/snippets.js
var SHORTCODE_PATTERN = /^:[a-z0-9_+-]{1,32}:$/;
function isValidShortcode(key) {
  return SHORTCODE_PATTERN.test(key);
}

// ../../shim/node_modules/asyar-sdk/dist/services/SnippetsServiceProxy.js
var __awaiter30 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var SnippetsServiceProxy = class extends BaseServiceProxy {
  registerShortcodes(map) {
    return __awaiter30(this, void 0, void 0, function* () {
      for (const [key, value] of Object.entries(map)) {
        if (!isValidShortcode(key)) {
          throw new Error(`[asyar-sdk/snippets:contract] invalid shortcode key "${key}" \u2014 must match /^:[a-z0-9_+-]{1,32}:$/`);
        }
        if (typeof value !== "string" || value.length === 0) {
          throw new Error(`[asyar-sdk/snippets:contract] expansion for "${key}" must be a non-empty string`);
        }
      }
      yield this.invoke("snippets:registerShortcodes", { map });
    });
  }
  unregisterShortcodes() {
    return __awaiter30(this, void 0, void 0, function* () {
      yield this.invoke("snippets:unregisterShortcodes", {});
    });
  }
};

// ../../shim/node_modules/asyar-sdk/dist/worker.js
init_BrowserServiceProxy();
init_FilesServiceProxy();
init_OpenerServiceProxy();
init_EnvironmentServiceProxy();
init_ExtensionRpc();
init_ExtensionContextCore();
init_MessageBroker();
init_ExtensionBridge();
init_PreferencesFacade();

// ../../shim/node_modules/asyar-sdk/dist/environment.js
init_EnvironmentServiceProxy();
var proxy = new EnvironmentServiceProxy();

// ../../shim/node_modules/asyar-sdk/dist/worker.js
init_errors();
var __awaiter31 = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
if (typeof window === "undefined" || window.__ASYAR_ROLE__ !== "worker") {
  throw new Error(`[asyar-sdk/worker] Imported outside a worker context. This entry point is intended for code running in worker.html (a Tier 2 extension's headless iframe). Did you mean to import from "asyar-sdk/view"?`);
}
function buildWorkerProxyBag() {
  return {
    log: new LogServiceProxy(),
    storage: new StorageServiceProxy(),
    notes: new NotesServiceProxy(),
    cache: new CacheServiceProxy(),
    search: new SearchServiceProxy(),
    network: new NetworkServiceProxy(),
    shell: new ShellServiceProxy(),
    oauth: new OAuthServiceProxy(),
    fs: new FileManagerServiceProxy(),
    application: new ApplicationServiceProxy(),
    power: new PowerServiceProxy(),
    screen: new ScreenServiceProxy(),
    process: new ProcessServiceProxy(),
    systemEvents: new SystemEventsServiceProxy(),
    timers: new TimerServiceProxy(),
    fsWatcher: new FileSystemWatcherServiceProxy(),
    statusBar: new StatusBarServiceProxy(),
    commands: new CommandServiceProxy(),
    state: new ExtensionStateProxy(),
    feedback: new FeedbackServiceProxy(),
    onboarding: new OnboardingServiceProxy(),
    runs: new RunServiceProxy(),
    tools: new ToolsServiceProxy(),
    snippets: new SnippetsServiceProxy(),
    browser: new BrowserServiceProxy(),
    files: new FilesServiceProxy(),
    opener: new OpenerServiceProxy(),
    environment: new EnvironmentServiceProxy(),
    // Role-neutral: pure postMessage forwarder. Exposes registerAction,
    // unregisterAction, and registerActionHandler so manifest root actions
    // (send-notification, show-hud, notification callbacks) can register
    // from the worker and survive view Dormant.
    actions: new ActionServiceProxy()
  };
}
function installWorkerRpcInterceptor() {
  if (typeof window === "undefined")
    return;
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data !== "object")
      return;
    const d = data;
    if (d.type !== "asyar:action:execute")
      return;
    const payload = d.payload;
    if (!payload || typeof payload !== "object")
      return;
    if (payload.__rpc__ === void 0)
      return;
    extensionRpc.deliverActionPayload(payload);
  });
}
installWorkerRpcInterceptor();
installToolsInvokeInterceptor();
var _workerToolsProxy;
function installToolsInvokeInterceptor() {
  if (typeof window === "undefined")
    return;
  window.addEventListener("message", (event) => __awaiter31(this, void 0, void 0, function* () {
    const data = event.data;
    if (!data || typeof data !== "object")
      return;
    const d = data;
    if (d.type !== "asyar:tools:invoke")
      return;
    const messageId = d.messageId;
    const payload = d.payload;
    const toolId = payload === null || payload === void 0 ? void 0 : payload.id;
    const args = payload === null || payload === void 0 ? void 0 : payload.args;
    if (typeof messageId !== "string" || typeof toolId !== "string")
      return;
    if (!_workerToolsProxy)
      return;
    try {
      const result = yield _workerToolsProxy.invokeHandler(toolId, args);
      window.parent.postMessage({ type: "asyar:tools:invoke:response", messageId, result }, "*");
    } catch (err) {
      window.parent.postMessage({
        type: "asyar:tools:invoke:response",
        messageId,
        error: err instanceof Error ? err.message : String(err)
      }, "*");
    }
  }));
}
if (typeof window !== "undefined" && window.parent !== window) {
  window.addEventListener("error", (e) => {
    var _a, _b;
    window.parent.postMessage({
      type: "asyar:feedback:uncaught",
      payload: {
        kind: "iframe_uncaught",
        developerDetail: (_b = (_a = e.error) === null || _a === void 0 ? void 0 : _a.stack) !== null && _b !== void 0 ? _b : String(e.message)
      }
    }, "*");
  });
  window.addEventListener("unhandledrejection", (e) => {
    window.parent.postMessage({
      type: "asyar:feedback:uncaught",
      payload: {
        kind: "iframe_unhandled_rejection",
        developerDetail: String(e.reason)
      }
    }, "*");
  });
}
var ExtensionContext2 = class extends ExtensionContextCore {
  constructor() {
    const proxies = buildWorkerProxyBag();
    super({ role: "worker", proxies });
    _workerToolsProxy = proxies.tools;
  }
  notifyRpcIfAvailable(id) {
    extensionRpc.setExtensionId(id);
  }
  /**
   * Worker-side RPC entry. Registers `handler` for the given `id`. Returns
   * a disposer that unregisters the handler.
   *
   * The `handler` receives the request payload as its first argument and an
   * `AbortSignal` as its second argument. The signal fires when the
   * view-side timeout elapses, so long-running handlers can bail at yield
   * points (`signal.aborted`) or pass the signal into AbortController-aware
   * APIs such as `fetch`. Handlers that ignore the signal still produce a
   * leak — but a detectable one: the late reply is silently dropped by the
   * view-side SDK.
   */
  onRequest(id, handler) {
    return extensionRpc.onRequest(id, handler);
  }
};

// manifest.json
var manifest_default = {
  id: "com.nassim.systemplus",
  name: "System+",
  version: "1.1.0",
  description: "Raycast's System commands for Asyar: Empty Trash, Open Trash, Sleep Displays, Screen Saver, Show Desktop, Hide/Quit apps, Eject Disks, Volume, Appearance, Hidden Files, Stage Manager, Do Not Disturb, Focus Session, Window extras (fullscreen, larger/smaller, move, displays, sixths).",
  author: "Nassim Lecornet",
  icon: "data:image/png;base64,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",
  type: "extension",
  asyarSdk: "^4.10.0",
  platforms: [
    "macos"
  ],
  searchable: false,
  background: {
    main: "worker.js"
  },
  permissions: [
    "shell:spawn",
    "shell:open-path",
    "notifications:send",
    "preferences:read"
  ],
  permissionArgs: {
    "shell:spawn": [
      "/usr/bin/osascript",
      "/usr/bin/pmset",
      "/usr/bin/defaults",
      "/usr/bin/killall",
      "/usr/bin/open",
      "/usr/bin/shortcuts"
    ]
  },
  preferences: [
    {
      name: "warnBeforeEmptyingTrash",
      type: "checkbox",
      title: "Show Warning Before Emptying Trash",
      description: "Ask for confirmation before the Trash is emptied.",
      default: true
    },
    {
      name: "focusMinutes",
      type: "textfield",
      title: "Focus Session Length (minutes)",
      description: "Length of a focus session started with Start Focus Session.",
      default: "25"
    }
  ],
  commands: [
    {
      id: "empty-trash",
      name: "Empty Trash",
      description: "Empty the Trash.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "open-trash",
      name: "Open Trash",
      description: "Open the Trash in Finder.",
      icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAGhUlEQVR42uVba2xURRT+ztzZ3dvdbh/blqWUxZYSEhGkrT98Fqox8b8Sgw8UNcYfmhgjPhLjI0RiouAj0Rg1vvAR4yNqlB8mPhCsQKJgoiCJIsUWS+nbFrvt3pnjj+1uu9Jttzu3Uvae9CbN5N6ZOd+c75wzZ3YIs5STe95jzGNZcPF6ms37Ob18svXdtNKjfR3zWX8EIosnwLj0ejICoGv3W3w2KD0TGNHmDTRrADp3vcmjve0oBAlUxFC95mbKGYDOna/zaO+fKCQJVCxBdcstNCMAnd+8yvGewlI+JXblElRffhtlBeD4169wvOcYClnsynNQc8XtdBoAx798ieM9bfCC2JW1qLnyDgIAmWrUrKC18gQAmlUmBdq/eIFHuo/CS1JUVYfYVXeSBADWCqyUpwDgcWtPAsA63eAZAFgnKdC242ke6ToCL0pRtB4SmsGaPQkANEN60fwn00Cy1mCtvQmA1pDMDO1VAJghWSvvUkArSLAGWM0ButMUIWjeIACpXaKAZgaSfxCB4MBMALCTKIJOBMQZREMzQ8IFJ6g1A3a4O7Z2w2/l9Y0rfHZx2UzfOPHhgcMfb/s13nm4QRCdGavQGpKhwQYU0JqhfMG+1Tc+oeySikty/U7axWXnrntw+S/vb/kp3vlrgyUINE2Fbi4AYhiGQWYgoRQWt1x30C6paAaA4f7uE11HD7Wxzp5dhSsXlkZrz11h+QLBldc+tPzQp8/uVUPdpURZIGBlxfs7Y1CJIiLALdqkw2AqL85n9eNjDiJ1DXUAEB8e7Pvw8Y02Ev9cZAkx5appzXBgjbXc8si+pQ3NF1q+QHDVugcuysFjO/1tP+//44sXq9RQd0wIcikMcv4WoJSG4ygdKl9QAwADJ451hMTo+cWlNqQQWQeNJ5R/z/bNjYRH9tU1NF+Yy1gkLBlZ2tAU3ri1/4eX7+rikcGoKQjMGhImFsAaDmsGUVrbkN9C2JawskyOmRHwCUiR8O/Zvrnx5NFrdoYiC62ZqveLlq+uiVTXLvUVhctjaza0Ht3xbNQvLTPfkEyE8t8MsWZoxRnVFYsIAoCYxpuRACggIeD421s/aBlLKCjOPklHM5Twnbp+ywfdwZJIVXntqrrDYwqSCCZWwNqQAqc7UE638XQeHYAUQChgISAJSktMtwaO0hiOO6HBrvYjwZJIVag8usjRrJTSFoEMN0MGFGDWp32bamOmGY+kLAKEJGCGdx1NUFpnqOooBc0AszBzgkkfwHl3MPlbntSWa5eEmU8oBSXBmvye1hrMIu+5T/gAmFoAZ3SYqwXMHmidscHg9FgmiRCnKOCOBSAPCzAfh80pkPdsmccNPxNXjG+M3N1aZhvHlAKetwCYAZCpKY8vylwAgEwrcAEAgFNHY5x3B1OaJtyuMk83jtlYrlJgYvXnhgKZAcclChh1Mq7wmfIBU42fBwBmQYA1CMwMIiKitGN2F4DkQ6mdDzOzBrkQBJJO0BAB8XfPX+0lVTWxsuq6xVaguF+pf8rhYiKkNMMKFPeXLaqLAcBg9/EOsI6Zh1uGNDEjBkMQ0HFoX9uKtVfH7OLSyJUPvt3Vf+zgXlfP20hQpHZlnR0qjQJAx8G9bYIQYxhSjTGeCucJIxHDEsD+T54/b8mqy04URxYsDJZVRYNlLdG5qmMO9XV1Hvj0hZVhkRzfTH+GyCDtLB8C4LcIvrHhyIePrZeHvvu8NX7q74G5UHxkeLD/4O7PWj96dL3f75wq91vJuoPJ/I0zQQCwBBAKCOj4UGXraw9XfpVQkEXhAWaAXMoAiAAVHyq3fdalxbZEMGDBEjBMgjKiQP4dEQCfRQjbFmwfIeFIKB4tczMKEAFWOACfJPgtATleBjEHIOUDDDsiAD5BkELAlqm9kIs+EMmDk+TjjvLp7bBbqStRZnGDQS4C8F9SuJdiG1WE/i/huTsfN/cBOKt/HwDDgkgBIOCKEzxr9YfhZqgQKEAA8P1zt3LfHz95SvnI0gZccvdryZ/KetIPjOsrJ1dyPKj/RI7x3TMbue/IAW+Yf30jLrvnjcz7Ap6iAfPUWebubTcVvBVE6hvRfO92ynppave2m7j3yP6CVL6ivilD+aznsru2big4ECrqm7Bm01uU88XJXVtv5N7fCwOEimVNWLPpbZr11dlvn7qBAeBsBaJiWRMAYO1975DR5emdT96Qdpu9v/84z5W+IP1/y/3vkCu3x7OBMR8lF6Uny79uC238QGiU1AAAAABJRU5ErkJggg==",
      mode: "background"
    },
    {
      id: "sleep-displays",
      name: "Sleep Displays",
      description: "Put the displays to sleep.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "show-screen-saver",
      name: "Show Screen Saver",
      description: "Start the screen saver.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "show-desktop",
      name: "Show Desktop",
      description: "Hide every app and show the desktop.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "hide-all-except-frontmost",
      name: "Hide All Apps Except Frontmost",
      description: "Hide every app except the one in front.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "quit-all-apps",
      name: "Quit All Apps",
      description: "Quit every open application.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "quit-all-except-frontmost",
      name: "Quit All Apps Except Frontmost",
      description: "Quit every app except the one in front.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "eject-all-disks",
      name: "Eject All Disks",
      description: "Eject every ejectable disk.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "toggle-mute",
      name: "Toggle Mute",
      description: "Mute or unmute the speaker.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "volume-up",
      name: "Turn Volume Up",
      description: "Raise the volume by 10%.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "volume-down",
      name: "Turn Volume Down",
      description: "Lower the volume by 10%.",
      icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAfuklEQVR42t17aZdkyVneExF3z32prKy9qqt637une3pGM5JGQoBtsdgG24DBC8ICBOLYv6A/+KMPPgbzASyDWS0ffKRjMEISAktiNBpplt57eu/ac99u5t1vRPjDzarume6SZo6ErOPIEyczb2VmxfvE877xbpfgPY4/b35a4vt4/Ejln5H38vl39eH/1fyTXaHrweb3s/yo6rO7r3+s8tPkOwLgs40/lABQ+z4Xeq8xNQbjH07+LHnPAPzP2u/LWrCB/x/GlD6Hn5j6F+RdA/Cntd+T28H6nj8o5WNmQD76FULI9y0I0/o8fnLqX5FvC8D/qP1Xue2v7yE4QCSNNK63FK4PqFA9IiEFEypHaAk1ykQkLAhwDYTg+w2PaWMe/3Tq58meAPz3rf8it/y1pwsvJJhgTtGfu1SK5nWd52aYVDOUUAoqPc6CgUf7zQFtRiPWKYaqWwmIV3kcCCkBKklEieoDknIRGZKCfS+BmjEW8FMzv0CeAOBPtn5bbvqrT/2S4BIa19uT3sr1inf0BUI1RcQcFAJh4CEMPEhCYJopMMpAzHjbMToP2nRNdbTujIvhLABYqNxSyVxDZTlwGUlP9BWOdgl0UI2FV/hesWbWWMRPz3ycAICyc5ELDi74U4VXY61TcZZvlKPDz8eCKoqIEQcObt+4jLu3b6Lf74IQhkw2h1yhhOm5henFxZXp2czpfpge3K6R29suCDLGcxpR8nOh9DxKCLWUAypYMIrjtSueWM1yNJZi+H/nQDwuJwGAP9j4LbnhPXwq7bXQ2F5wjj/MeAvvU/U0GCUYDTr49B99Cp//iz/HyHFAKQWhFIwyMMaQTqexsLCI5QOHcPL0Mzh4/GjQzhTCAG7LDb402hzcP2hp6YGq5ztmaqZjpRelpk3lYzFy4vhe7Ii3TnASZgn9u0NhzlzCz819gigAICSHkPxJgxeTIO9X7mdG1ReppoIxBkokXv/mK/jSF7+A/sCGaVlgYwB2vmfbQ1y/fh23b9/CN7/+Mn70n/yUfuyjP6nTni8W0ocbNM+ubkb3zgXSqzh2LdScO01Tn9vIZY8JQzuRQ1S+HIqrFUfUDxH6d8OGHXlp8kaAS/72KWIgpP18UNUlKBRGoakqXNfB1SuX0O/3YJomVEUBpRSUUiiMQdNUGKYJTdfBhcDa6ipu37wG4Y1w7dLV3Obl7nOL0bnJ07kPfbmQLW2TFNUCZs923avnthqfnxn03ugabCKTZh8Y5uihr0dxhFjwJ9f3HU4hRQLAp1Z/Xa66d3dZsDM5jwGfDowwOxvHMSghUBSGMAwwHA4fnfs7PoFMXAIpJaSUIIRA03QYhomRbYO7I1y/cR2f+p3fxJc++/l5+TB34ah8qVbSyg8Vk0BJMyVUOot1+5VztcbnJY+HYVp5Nj1Bn/8K4XA5j59Y43cyV927+NTqr0sqISHkO6aQiGMBwplHOMskQkooCgEd6zl55P1APo7AO4aiqthcW0d7fRWV6iS2my382Wc+jU//we8Zd15eP3sg/KA9qx54jTIiVEsFsWD1onsn15tfmBqNbnXS6uFimX74NVWkWjwWT671O5gSEuyjv/aRi72oA/nYQwgBHnMwV29NiaU0JDM1TYdlphBzgRtXL+He7bcAYAxGYk8JISBIdJbsWHJC4IxGWFlaxLGzz+DBvQcYtpvotFtYe3gfWb1S3V8+Q7Ip61JH1ialIlUwQgMxKvSH61lFio1C6lCWiWotlnUSCCcnicR345FTC2D/4Nd+4AkAAIBzDvhwpsm+UIGeV1UVpmlB1XTUa1u4duVNBGEIRVESg0keE3wHjPF7ISV0leH8hQuod/ro1jZBCUEQhlhfu4/Yl5l9xdOTE5nqax1sZjnjJlEIBCKzP9qs8NjZKmf2ayaZ63PRiFw+LIDguwPA3//kD1zshZ1d3d2ZPBYQEcISqptZpTTLKINuGDBNC67n4+ql19HttKEoyo4mAI/t+iMAKAih6Ha7WF5axP7DR/Hw4Rq8YR+GYSKOI2yuPcRwYKvzhaNzC4Xlqz1skxB+ljACUKEO3UZFhINGIb0Mgyy7QjRcJx6UQPDEut/LzKlFUPE0KwkOSQViGqR7ou2nLBOUAlJwaKqC2dl5TM/NQ0KCc/4oCHqbDXj0hjGKIAjwza+9jIlsCgePHUcqm4cQMQzDAlMUXL38Gj73Z39K+7fiC6eiH2pnZfGeIAJEJ4AptE335sm7tb/SGJOo6j/Yy5HKvSiOvsOTgIP9vU++dLEXtccLfjSllIjiSFEjvbGoHZxljEFRVViWBc0w0et1cePqZfiBD6awxKci2LUBO6cEIWM7QQha7Q7mpqs4ceo0tmoNuMMBKKPQdQOqpqHbaaPZqGGquK96qHSqZdNGw4VdJgoIYZI5Qbvse93ORHaFp9iS48UbIpCjPIh8Yv3vZua1ItgP/8pLF7th+6kU4TEncRDF0/rcZsGaqDCFQdcNmIYJwlRcu/ImGttbuwISkoDwKEQmu9cZUxDzGMOBjdOnTiKdL6DT7sBzHKiaClXVoOs6BoM+mvUtVIoL5YOF064t6xsOscuEgUoi2cjrlCPfbk3mDhETcz0nXtUD4aWB964OBbUE9kO/+oEEgHc8dkgcRKGm89Tdg+Xji4CEqmowdB26aaHdauHmtSuIeQymKI98AkIfM4QElBIwxqAwhn5/AF1Tcf7cM/CCEO1WE5wnv6soCgzDwHBoo1HfwtTEQn5/4VTYF9vrIwwmiAIiiWS23y6LwK1NFo7quixtD6L75VhG2ns1jHmtBPaDv/L+i52w9dQPCEjEPFR5wAf7UgeQNrJpSik0XYNpWFANCzeuXkajtg3G2NuC7MT47QCQeIqqpoFSikajgbmZaZw//yxanQ4G/T4IoVBVdQyCidFwhGZtCzOTi7n9+VNhD9sbI/QrYCCCcNZzGhOUi7Wpwum8Iqz7Le/WPCje0wFZSAB4cU8ApEy44AWOYYrUjQOVo4uUAIwp0HUVVioLezjE1ctvIAzDx0BIdJ8SAkIJGKVgLHGgNF1HFMdotdo4cvgQDh48jF6/j36vB0VRoKgKGGPQDRPDoY12s4b56eXcgfwptxGvNhzYZcIIhOSK7dQLJk0/KOdOFCmP73fD9XnQd8+ColYC+8gnXrzYDVtPNxQkUYQwDow4iLv780doxsqlIWXi8xsGrEwet2/dxNrqfTCmjP2ARB8Tf1vueoyUUjBFhaEbGA6HGAwG+PCHP4zq9DRarSZs24aqqmCKCsYoDMPAwLbRbTexOLu/sJg51NqO7418OAVCCWIZ6qNRUylas/Wcud/wg3pvxLsVQvCujGBRK4N9+BMv7M2AHVWQEiN/aBkidf3I1IlFKQUIIdDVhAVEUXHpjW9gNEwEkJCI4xiQMjGaVgqapmHneGAKg6rp6HS6KOSyOHP2LPKFEmq1GlzPg6apYEwBZQyGrmPQH2Bo97F/7ujEtLX0cC28TUPqpyUFvGiU9j17OJE7xjVaGvaDu5lQBqZ8F/agoJXBfuATL1zsBM29kSIAiEQQB0bc59snSs/MWSkLXHAojEI3NGTzE2g2m7h5/QqklFAUBdVqFWeeOY8XPvAhPHPhBRw/cQqLi8vIFwowdAOEJN7m5tY2ysUCTp48BcO0UG/UEYY+VFUBo2N10DV0Ol2EgYvDC6enivrE1bXgZlEwroGAuF43zwTWq4XTOcLleie4t0Dot2dBSZ8A+9Avv+9iJ2h9W8IILhG04vpkPFeam51VGGWI4xi6moS/mUIZt29ex+b6Gg4fPoIf/0f/GC9+8CM4evIs9h84hP0HD+PwkeM4fOwUDh4+iomJCigBGo0GNjY2Ua1WcOz4cRCqoNVqgUfJybJjO1RVRavdAqPA0bmz0xrTX10P78yAgnEIxfMGWs6Y2cqY+4zO6IYSwk8np8Les6hNgH3ol5//1gzYMYZCQgzR7VyyrdmpOXNychJRFAGQMHQNqUwelGm4c/sGTpw4gbPnLiBfKiOXyyObSSFtmTANHaZpIZMrYnp2EQtL+yAFx/rGBtbW1jE7M4WDBw8h5hLdXhdCcCiKAsooFEUBIRTNZhPZbIYeqp4pe3z4ep2vLxACBOHIElHYrRZOKm7QbQ+jrRnQbw1BUSuDfeiXnr/YDprfWlukhIgFUjLbvfa/76iBE6ZPnz4NXdcRBAEYYzANHdnCBIIgQOA5mJ6dR7VaxWSlgmIhh2w6DcswQBkQRSHCKIZppTEzOwdVVXDv/gOsra1jbnYKyysriCKOfn8AKfnYHlAoTAEXAp1OCzPVaW2hcAjNYH19ILuTkoAE/tBMqcXVYmo/et4DJZBO9lv5BiVtAuylX35uzADsmQ7XpdmPryrfvPmZBywt8wvdXp+BEKysrIAA8AMfmsaQy2RQmJhCHHFAclQmq6hUJpDLpGEaOjRVAWMUZGwkXdcHZRrm5+eRzaRx/+FDXLvxFjIpE6dPHUcqlUavbyOOOShNHCpFVRAEIZqNBhamlvL78sf6rWC9PkSvEorQiAPXXah82PDDbt0O1qclSbJeTxslfQLspV967mI7aDzd+gsBLTIbrc+5N1/+nddPqkF28Uc++qMsk07h1Ve/gVK5iKXFRURhiDiKoRs6Uqk0wHT4ngOFMRRLJVimAcZo4l5zgSiOEUYRwjCC6/kglKJULCIKQzSaTWxsbkNC4uTxo8hmsmh3u4jCEIzSsVepwHE9eK6Lg4tHyhm1+HA9eMsISWCFvmOUMofWsvqEaLv3jRBOZi8WlPQK2Ad/8cLF9lMYIIWEGacb3c/5d//mt195ztDS1g9/9Mdx+NBB6GPKXr9+A8eOHkW+kIfnupBSIp2yoKg6XC+E7zvQdQ2pVAqEEEScIwgj+H6IIIwQBCH8MEIURTB0HYauYtDvwQ98NJsdjBwHRw4fRKlYRKvTQxBGCRNIMgf2EIau4cDs0aIX+JfWozuLYRzqU9bKg2L2aGW7f831eKeyV8kuAeCXngRACgkjtjr9v4xvf/l3X32Oc6EcOnIcz154HoauQvAYlBK8/PLX0O11cPLECaiqAt/zQClBNpOGkAz20EUYJuc6VVREYQzfD+D5Pjw/gB8ktoBzDik5TEODMxrCdxL2dLpdtFptzM/PYWV5GUEYYDhyIbkEoxScc9iDASYrVXWusCTbwdbDbtScqujz66XMycl6/1p3KLZnCCNPrYKW9AroOyMkwQWUULUHXxBvffX3v/mcZWVYoVBMzmXGYFkWTCuFcrmEqelpfPGLX8LLL78MKSXCMEC/10UUupibnkC1OoUglKjVG+h2exg57nh6cF0fQRghjmMIIRBGEQCCcqkEXdOhKgwpU0e71cKXv/K3aDQaeO7Zc3jm7BmkCzkEcZKHGA2HuHr5EgyeWTptvRSqQnX8YMgUomkUGpdcQAixZ0TIPviLz15s+83dnaex4ouvWW/8n9/+2vPZbIFNz84khlDXcfTYcUxPVWHoGlzXRRSGsAc2FIWiUMgjm83BcUYIwwCplIl0JgPXizCwbQSBBwEgjDhcN2FAGIZJ6k1KQHIQCERhgE6ngyiKoCgKVFVBFESo1Ruw7SGWFhewb3kJHIDt+hg5HhxnhEzKwr6pFcsL+1fN1HQ8lTs0cbf51+5QNqb2YkDZqIB94BefvdgOGsnRyBFn702+8pf/4SvPZzJ5ZXp2Fvl8EYqiwHFGWNq3jAMHDyCVsuA4Loa2jXw+C0YZarU6ctksLMuCbQ8QhSFyuQysVBqOG2I4HMJxRohjntiCIEQUR5BcADI5NaSIEQQe2u0WgiBKgimShNKQEt1+H5sbW5AADh/cj9m5ORDThE9VuGEMK5U3M8a8VFNL+Xr30urDwcuLsRqkCcMeAEyCfeDj5y+2/QbAIfOjyvW/+fevnyJQ9Nn5BWSzeWSyOeiGiU67BdM08NxzzyGTTsHzXPR7fZimAUCi1++j1W4jn89DYRS9Xg88ilAo5mFaabheCMdx0O91EYQhpAREnAhOJAcEh+QhPNdBq9VGGAag9NEJRsfBVBhGaDTqWNvcghACK4vzWF5ahJZOIyAEUsvlW/Zbt6+0Pjs5pK05plNQ9nQjWNYrUOS4DiBDycVtzXZsz1he2Y9sLo90KgXDMJFOZ9Gf6GF9bRWu46BSLqFSqSCTzaJe20IUc6hq4sJ+/dVXcfrUSTCF4f79e/B8D3OLy5ibmwJAxkddDaqiIZvJQmEUgghAcAgRw3U9eJ6PKIpBCANjAJESgjyy/oQQuMMhrly5irdu38FEoQBDV2Gl0zh6/DSkKuIrxE1RjQD0HQ0d72j0YO//N+cvttwGhI8gekP1nHZYmZqeRiqVhmmloOsGrJQFXdOxubmJhfk5rKyswDJNDG0bjUYDQRAkcRMlsO0hbNtGJp1GFEdoNpoIQx/lUgGmlYGEgjiKUNtcx9DuQ1cZiIjB4wCB76Pb7aBer+8mWx9VmwAJATH2ZCkBGKUIoxi9gY1uu4t+uwVdVXFg7nh+O1y93yPNmb12P2HAJNiLHz93sek2wH0hMo3JtteNJ8vlCZiWCcMwoOk6FEWFlUoh8Hw069s4cPAAiqUSGCVotVoYDocQQuyG/qPhCKPRCKZhIggDNOp1eI6DQiEHK52BollgjKLT3ELgjgDJEXgeRs4Q6xsbaDSbIKAglEAKCSkFpBQJU6WEFEmFiECCABDjfIPgHFEUYt/yYd3QlNWt+IEe0iC9VydU2aiAvf/j5y823TqyslibaC2k7K6bLRQKifCaDlVNghBVUWFaJi5fehO6pmJpaRGmZYLHEdqtNqIofKysTOC6LjzPhaKqCHwfjUYDdr+PTDaNVDoLM5VDLl/AcNBG4LsglKBeb+CN19+A67rQdB0Ye6NCJB5kAoLA7tEmBDC+xqVEzDniMMD0zDymCjPmfed63UZ3kuzhDE8Yk2Av/sK5i41RDYfVU9fS7clj9mgEK5WCrulQ1KQkTiiFFAKapsFxXdy6eQOTk5MolUpgjMFxXfQHg90UmpQCBAS+78P3/YSqY/+912kl6bRMBoaVg2WlUdvexqVLb+IbX38V9UYDVioFxlgiPBfgnEMInrwWHJyL5L3ku0BwLhALjiiKUC6VMTO9lLLj5q2GWK8IwtWnM2AS7H2/cPZiw67hGJ5dT4X5edsegjIFmq4ngcu4AiykQBxzpFIpbG5uYn19DbOzM9A0HUJw2AMbruslejsuPIIQxFHi6gopEYUB2q02Wo06IDislIVMoQIrk8edWzdx9eolEEKT3R87ZTzmEDzxFmPOIXhSuRZjoROGJEBwkThjhqFjanoOacPqP/BuwCdu7mkhUQLAxxIAloKD23PZxdlYCAzsIXRde9T0IJIKUBRFEELAMEzcfusWBoM+qtVJ8DiG7/sYDPqI4nicHE3oC5AEvChZdBzF49z/Nnx3hFQmi9LEFM6cu4CZ6Rk06lto1mqIohBcikTgmCOOY/A4AYJzPmZCMsVjDAmjECpTMLewhHw6p9waXuqMaL9C9vID3vfzZy82hjVMKXP3FszlxXK5jI2tLUgpQSlNSuWcg8cxoiiG77tJzY8S3Lx+HXEcoVDIw3UdjEYuBvYgKYsrSYY4ASExVlyMBeICruuiVa/Dd0cghMBK53Do6EkcOHgInjPE5sYqhvYgYYAQ4DxOdDyOwUWcgMIfA2Q8wzCEwhj2rRxEMVfUHrrXVztoTBP6pCmcMKpgL3zs7MXGqA4Ws96CPFBZWJinruehVqtDURRwniAfhhHCMIAfBEnQQyiCMMKtW2+BUoZUKgVnOIIzGmI4HIIQkiRIx+zBuGmCUDLWaYE4itBuNtDvNBFHAQhTMLuwjFNnzyGfy6HTaqHZrMP3XMRxDLmz6zEfr2tHJZLnmHOEYQDdMHH4yHFUJiZozb1/vyHXq4IKlTzNCL7vY2cutrw6XNdVZ+VibTJfLU1NT+PevYcYDkcgBAjDEGEYIAwDBJ6PwPfheR4IARzHwYMHD6CqSZrccz04oxGc0QggSU0g2cEIQiQ72Ov3MLBtUMIgIWH3e+g0a/BGQ3AeI5XJ4+jJszh0+BgUhaHbbqHX6yLwfcRRBC7ELhhxHO+CwDmH67moTk3j5OlzyGVSqLsP1jb5gwqnkf5ODkzsGMGmX0cQ+KZBzOtZt7y4tLQIISTu3L2bUI5zhEGAIAjg+S78MQC+70EKgeFwhK3trQQEXUcchgiCAHEUwzB16LoOwTlGIwfD0Qi9Xh+2bSOMImiqCsoYoijCcNDDaNBF6LsQEqjOzOHkmfNYXFqGrmkYDm3Y/R6CwEcQ+LsGNoqTZ8d1EAY+XnjxJRw6cgwKBdZGN1bX47szgnLtCQDMSbDnP3b2YsuvA1IS2x1o5WCqocMozs/PodlsYmNjKzGAYQjfeyS477nwvCQrE8URnJGDTre7m8tXFQW5fB7FUhHFYhHlcgmZTHq3/KXrWuKiEkDXdRimCd1M0uWh7yDyHYS+C8oY5hb24eTpZ7C0vIJ8vgDGGEajIcIwQBxHCMMQQRhA8BjLKwfw0R/7CWQyaYjQx1X71Y06NhbABHuSAVUoOxlSohHYar96K778inbX2neYMXrm1AlsbG5iY2Mryf3t7rwLz/fgjUEI/OSfu46DBw8eolwuoVIuoVqtojJRweRUFcVCAaZpIAxDbG5uora9jW43UYVisTRem0Q6lYZhGpCSY9RvAjyEO+whnSvj0JETOHTkODqtJu7cvontzQ04zhCBH4AqDBMTFZw+ex7VyUl4roMw6vWbwVYu1kONUYYnm5hkEgxJSIABVAO97V05YyD9Ve9N74NT09M4d+YkBv0+1tbWIYWA6znwxl6e53rwAw9xGO2e/X7go9cfwA/DJKPTbuH8hWcxWZnA5GQVqZSF/SsraNRr+PO/+AusNrrbleX8PUVXpBJpukW0VAa5faZmpnTDgGnoUEmMcNREZ9gGVXVYVgbnL7wPiqImTZo7ZTfGIIXAyO4DsYdr9tevtGXt5F4BkZQSipSPVbVVitjk1h336opFM5d6N/uny+UiVvYtoNloYLtWQxyH8D0Pnush8D3EUWLcAIDSJGNUnphAoViCFALrWzVsfuaz+Marr+Lw4UOYmZkBpMTt27fx+S/+FWZfmLxfKz5YcYWb0kxtJAMSTJDJy4dTp6yiXjxlmhbRdR26poKAII4j+IGNodMFiAKmaGCKAjreYR6FELGHDt++fsV7bcrV3bxK2a6X/kQzKAD8u1f+tbzRvZzE6JFAZHNMeDPXDnRO54dNZy6dTqO2XcOly1cSEKIIYRAgikIIwROfgSnIZnOoTFYxUZlELp+HlUpBSgm7P0CjsQ273wUFARccjWYT2ULaPvPJgw+Gxc4pqiU1DMklEJI4FWZrC9r+1TOlC/n57NKRbDrDFCVJq+94ld7ORgQB4piD8wiUSHR468YrwVfiTWX1hJKhhGn0iYTI0eIp/Przv0uUHV2Q4zogUQAlTdESW0eMnPWN8mA+u7q6ljMNHfNzM6jVa7BtG+NAFUIIKIqCTC6fCD8xgUw2A8MwoGs6rHQKU1MzWDl4ECPbhm0P0Om0MTU/71ZetN7slTZeUNIUVB0vUkiISCqOP5h7y39zcr15vz4/WH71XPU5dX/p4HI1P10ilCSBEReIojAxyq4L3/ewNdq499XuX8stunZSTSkgCiDJ0/IByTVl9/WYH4QAVAGYBVYTD0+TKfKaNcyd2d5opg1NxcrSEqIgQK/XBQBouoFcPo+JyiRK5Qmk01kYhgXdMKFr+rjASWGaBrKZLNKZLNL5jINl+7X1/M0LxJAKUynIuLVAUgLGAKpQCF1qo6A7f8PvTq+u3W7nN0u1ldyh64crx4zZ3MKkzgyLSKmGPBRd3hvcsW9svt57tbRN1o6qKQqmAoQ+hfuP9XDtEuPfvvwv5fXupd0/Ci7BPQ46UpzqcOlN7W7+6NrdjaKqKBiNhlhbXUOr00Y6k8P09CyKpRJS6TRMy4JlmjAME7phQFM1MFUBQdJE7YXDETvivHFPvfI8zUJVLAaqPJm0lONNkTxRSxFK8ECAxaqncd3Rie4ZNOUwSTmHoD53LE/18pHmZ5lFCNMpyB7JkGPF0/iPL/y3t98v8HhvEAhAGEBNCi6j1Cbun68emr+0aMxV7l9+uM80LJw9exau56HXH0BSBqaoME0TlmntJlKSZoekd6hv2/DCYY8f6Fy/r91+gWUIYxYD9qIo2Wm1ASgjIBoBNQlkzM0gdkw/GqEvO7v5B8IAqlIwjYCq41QY9kiFPXb9bRD92t/+3CMW7DAhluC+QDzkMueX701uLY56d4cnFKaw6ZkZZLNZdHsDtLt9xFzAslJJPkHXx7EEx3A0hFT9jfBAa2tVuf2smqWEmQxEeQ+t8DutyEluDI+aT8YtaXTcf/Ft2uuPFU/jP734B2TPm6Y++bc/J6933nz7PxYJ/WJHQHOMzrxcuZntlzO6a+7PZ4upyclJWGYK9WYTW7UGRNIhxoUAFTTs+enBnXruXratbR9RMwzMoO9NeOxpw97TbaDHSmfwG48Jv+dXPvnVn5XX3gmClIke+gLcEZIGijtBpx4uGsvtMquaGTWTSqUs4kpveK1ziXfclqkQNbYxKAxoa4GmiMpSY92k5F3es/rdG8dLZ/Ab7/9D8q4x+9Wv/vO3g7DDPp4AIUIBEUjwUEBEEkm6FiCMJLvLCAgFqEJANQqqE1CVjnuJv/fC/+b7/4i851tnf+UrPyMB4Ek2jC10LCH42Hl51COZ7PDjOrlz7f+B4ADwnz/wx+Q7unn6E1/+mV2Nu9Z540kwHvczn3bHF/leCn129/VvffCPyXfl7vG9wPh+HO9G6MfH/wUnmQfs1j9pxgAAAABJRU5ErkJggg==",
      mode: "background"
    },
    {
      id: "volume-0",
      name: "Set Volume to 0%",
      description: "Set the output volume to 0%.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "volume-25",
      name: "Set Volume to 25%",
      description: "Set the output volume to 25%.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "volume-50",
      name: "Set Volume to 50%",
      description: "Set the output volume to 50%.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "volume-75",
      name: "Set Volume to 75%",
      description: "Set the output volume to 75%.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "volume-100",
      name: "Set Volume to 100%",
      description: "Set the output volume to 100%.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "toggle-appearance",
      name: "Toggle System Appearance",
      description: "Switch between light and dark mode.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "toggle-hidden-files",
      name: "Toggle Hidden Files",
      description: "Show or hide hidden files in Finder.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "toggle-stage-manager",
      name: "Toggle Stage Manager",
      description: "Turn Stage Manager on or off.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "toggle-bluetooth",
      name: "Toggle Bluetooth",
      description: "Turn Bluetooth on or off (uses blueutil if installed, else opens Bluetooth settings).",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "dismiss-notifications",
      name: "Dismiss Notifications",
      description: "Clear every banner in Notification Center.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "toggle-do-not-disturb",
      name: "Toggle Do Not Disturb",
      description: "Turn Do Not Disturb on or off (runs your 'Toggle Do Not Disturb' Shortcut).",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "start-focus-session",
      name: "Start Focus Session",
      description: "25 minutes: Do Not Disturb on, other apps hidden, a notification when time is up.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "end-focus-session",
      name: "End Focus Session",
      description: "Stop the running focus session and turn Do Not Disturb off.",
      icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAZSElEQVR42t2beXRc133fP/fet82CGQwGOwiIBElxkShqs7VZoqxadm0ntdss7rHjtXbT1Et7kjpV3KZ1Tk9bx4mdJm5ykiZ2G0WyFS/VUew4tk9TyxRFLdZCiaS4ihtIAhgAg9nfvO3e/vEGIClbm8meY/niDDAHmPfwft/7W7+/3xW8ylW577uGn+I1/E/fIl7N51/Rhytf/vaq0MHpyk+z/Lhrhs+B8e63iYsCYP6v/takQs/zWlzumhEARt77dvGqAZj9y2+aYGaOn4XlTo4y9v6fF68YgNn/+YAJTv1sCL8KwtQoYx98h3hZAGa/eL/pnprlZ3F5U2OM/bN/LF4UgDN//g3TPfmzKfwqCJeNMfGRXxA/AsCZP/u66Z44+5oVTBuDb6ml2LY6+W44psB6URDWjjPxq78o4LwP6USjE/2aE9xg0Nowl3MPnNg4teD3F7JbnzlcG6k1tykhfzxY58kpAGb++K+Nf/zMa3LnQ51EB4eKj+/Zvnm6lc+MWa7L2JHjT9y079jwQKSnpBAYTE/YcxafWTfB5EffJSwAkySYJHnNCZ9ozZmsfeTJy6fWtjxnrFOtgpAkSoxX0dVCFCGFIPCcM52h4kxhvrbZjuN+gViVNwVAG8xrTP0NhrbRrcOD5YVOf3Fre3kZIQRGaNroQisKFoIwpjVRfuzshklnfmT4ymu+/8Pjg8tBv5ISo1OtsE58/m7TOXLyNbn7c1l14vjU6PZOu4XAYLRGI4jD0GpFYbdy2cjO2qapdfPrN05y5OjxZLnWn8QglKRz5CQnPn+3sTAGY16Lu5+0jvf3LSbF4pVxvZ7+XmsSA0miVWvbhuJyuX9ocWKy7C8t+lO7flh12t1rjethTM/9GYNltH7NqX+iNS2p26dLhRE/CDFagwGdJCQ6QevYjvuym5f6B2gaQ+l7P/jhwPzyzU4mJ4Q2YAympzGW0emb19LuJ1pTUfpse6h8TRR0QachPE5i4ihC+z7zRlMYU5R2PvKD8ZNzV/dZruUIiTSsarzRBsuYNI7+ZA8Dxrz4tUIIBJc+4ekkced03qrLvgK6VsPohCSOicOAOAxpL1eZLxQYf/KZR4f3HtrUh1V0lQ1GXCCrMQbLJPpVhcAVobUx+FHnbODXZ0zUDYxJTDcKjSUVQiqhLMdyvb5+z+ubtoSVEUJcEkC01vhJFC8rx4q1xiQxSRITdUNCv4PfbNCsLdNttegbHF43etN1R0y1cTSZqWyQfjhqznsOk2gstIZX4ANWBO+ErZlOs3I8ac5lVXd5WupkuzYIgxGuEGhAG2GMECYSIqlb3rzOlE47mQGT7xvakHOyYwKBFOIn0rZYJ/iummsPlobr1SpRp00UdIk6qfBdv4OyHYwxnFVi5PCVm8r7ojgp3KLqk7MLu4eOzej+IzPXWonOojWWNgb9Mj5AG0OQRK1Wc26vXDgwZUWd2zDCGIGIDegVWTQYITAGVu+YRDkVtKbi+mkWF72FpcL4g4W+8TV9meIGKV4aiJ7Qxgh04FhLzcHiscW1o3pmfGibUXZf0XVxHYew1eT5PU/RbjZxM1k8x2ZgYg3rb7yJemXemjl82JK5/PDxicmhgfVTet21tcNr/35310uSa8ThT/+JaR068ZLCt4LGic7iodlCc/amrgGNwJz399QPpGZhBCAExhiMSdPPFbVDSKQUxMqtm/zYM4X+NeNFr7jhhaaR3s3oSBC2SvmD9amR+szk8Kb6mjWj9tgESRBQGBoik80RtJrs37WTQ0/8EM9xyeWzFIdHyY+M0pybo15dQnoZlOOAFEjbITc0zHSiK2/dvWfYeqksMDGaemdpb7yw3xkIGzc1tEjDJwYMJDoBJXEGBvGGR/EmJslPr8cqFNFRiH/2LO2TJ+guLuAvzRPUa5CAjJOiq0/dVm3Pz/vlzU8O5AavsKXl9Txn3HVVtdafOza3aSKzuHH91fHQOF2/Td/EBP1rhghqXbAsGp02Rx59hFNPP0W5WCCfy6Fsh6C6SP3UCTpRjNtfwnYcpGUhlEJKSae6xHy11vLDcDjNA36MCSRGs9Ra2pcs7cuNxe3pZQ1CpKptkgQtIDs+ychb3sbkL76L3NTkSxiwoXb4MDP330/lsV20Zk7Q8X0sKx7pVPaWOvnxR8p9kxvtXD6/vGbw2dlt0+OVwfKNvuPhjY7Sv+4y3FoDy3bQ2pC4ktrCMs3aMjPP7UM367iYJO4GUUsqp6uNxLKwsi5SqZ7TE0itYxmGvltrVDY/fbBmRkbTMPhCALQxVLuNU/XFA8lW3ZmuaAPIVDXjGCyL0dvvZPMn7yIzMfHiBixW4yH9mzbRf9ddxEHI8a/ex7H77qF1ZgYV+k62fnLHrDKPNm96q5zdsuHmKN8nZS6Pl+/DKxRxMhbC9NFp+AT1Dng2jeVlajMnKZWHGHLdYLIT7j3+/PF2M+N6XjabM5ZtIRGy7aNqTa3iOHSbrdbAwnIyvdDYPmS5690JeyURMhc8dzvqtqrV48e30d6xGCeYnqMySQK2xWXv+RAbP/pxVCZzgczBwgJBdYmwViNut0GAyuaw8304xSLu0BCW67Lxve9j/C3/kMNf+iLHvnov7foynRvX3jh75Sai0gBOLo+Ty2G5HghF4EfgKlpdn85CE2FZhK0W4ews5Shgm3KfzTz17NRwrTWyor0aIoNYcctKIZUtFa5SZK0MWcvBlRZpLXAeAJFOWGhWDpTD+R3NJCJBAAJjNEkUMvVLH2D9r/7aBcJHzSaN5/Zz7J67WXj0YZJ2Gx1HqQpYNjLjkVu3gTU/9/OM3rqDzOgoueFhrr7rt3AKfRy65x5mhsbpFvvJFYrYmQzKcdFSEicJ/lIdp1wgBpqVebrVJfB9hpTkStx95Sf3FWlFIxkvn8b3NHrY50iP1HdZQqKEwJLq3HtjNMYkq6q/HDTPNlqnchuVpBqZ1PABHYV4oxNc9u73Yvf1nSMkqssc+Ys/5dR99xLUq0gvk16jJFprTBwQN3z8Jx9h8anH6Fu3kTX/6J1M/ZNfIDc5xdZ/+THkaIlnZiogFcp1MVIRaU0cxYRxRLfjY6rLCCmIO23CuVlKRrO1r3C4/6mDsThTubLPdnGlxUulFyuxRggQaIzR50zAAKGO9Uz97JENntjh+wmrRZPWGCEYvOVW8hs2nHOU3S7Pff6znPr6lxFSYvcVSYIuSIU7OAyem4bEOCZqtQhrNerHDlH/o88x9/AuNv2LjzJ2xxtYf1ODUb3A0SgmSgATEWtDGEWEQZew06Fbq2HCANNuM2BZXOllTozue74RHZ25Pu9kcIRCpSHqFWRVqbyrtYDRGm0M9W6rEvmVyzL9HmGSpA+PQMcRzkCZ0nU3XHCfE/d9hbPffgApLYRtk/g+7tgYo7feQem61+GUSqAUcadNZ+Y0lScepbrvWfy5WSqP76JTWSbsvIOpyx/nspzP4ebraeWKSMsQxQlRNyDyfcJWg2C5Slyt0q8kWweHzw4+e/hM8MyhW/ptjxcWOa84uzQm9QHaGEId69O104c2OXqH42XoLi2CUqwA1Hf5JoZ23L56cf3gIU597V6SdhvpZYg6bQZvegNX/MZdlLZv/7H/cPoDH6C2fz8nv/UAx756H41jhzn6lf/ByH9cy/axNt/71t8x21D0jfSTRCFxxydsNYnqNXSjzojnceuayWPmOw81zYnZW4q2h6ssZK+2f9UlnTGpD9BJQhBHmu5iNlfOYBz3PDXRoBTZybW45YHVa6uPPkK3UkFYFkkUYhf62fzxX79A+M7cPM2TxzFa45QGKGy6nMGrriI7PY03Psm+P/oTJq43NNsBB55tsC54jMqRAnP17Xgu6MAnbjYx7RZr+otcUyo/b3//8UZy7Ow1RdvFkwqZPiQ/ST2b+gBj0EbTCTuLA0lrPW6pl9abVZSEZWH3FS+4uH5gH3GribRsknaDqV96N6Vt2841Vnfv5sAXPoe/XMUYg/IyFLdcyfoPfZjy5ZtY954PoLIhtaUvsHTAEHUNE/0Bb2p9nwONNgf8USIkHpq1w4PmdV7+WfN/HrWSMwvXFG0P72J2/oJy2BgSbeh0G6dLIr4+UQpHiNU8xpBGAmGp1QvjTofu0mLKJqcRltE73oR0XQD8+Xn2/pffoX5wP0ZZvbCkqR0+RPXwUS7/4D9n/E1F7LV7Wdg1QLA4D7GmMF3iljsHuXPtTTz2hMdTu3ZTGiwzceyw7p5ud3PzjRv6bQ9PWkgkwlw0u4KVVsOaOGq2pRDEGrAU2hjUC7LD1fdRjEniVRSl4+H2l9KCB5h98EHqRw4gM1lMLwZrA6Gf0Hp+Lwv7fpdmfhuDa9/B1I5befq/fY7WqRn8kx4b3v4hRtbeyR0DMfbffIPWUw+jul1VEwP+cG4NjlQXvfPnuQAkRhNrja1DEm2IoxBpO8iVik+kHLrudlcvtLKZ1UTI9KrB8x+nduBAL4L0jMkYBFDe6jL8y3mef+oY8w+0yZdfx9CO2xi47gaU61E/Pc/pJ07Tbmjc0gDlyzeRLC0Q+j552tOxMTVW/t8leGEMElJW2JiExGj8dgtjWeluGpOGwSgiWDg3JCFtm8zwGFhpZy0JfMLaMj26leyaibQsNgZtQGuDKGiWpmIO/t8W5hlB+NxJKnueRBVylLZuxin0oYRm4eEHCWtLxDph7G1vx+4rgJRkY39sSbee0z1S85K8MMgVeis2gsQYfL9NAkjLTpNgkabBzZkTNI4+vwpC8aqrcUolhElpqbmdO4k7HQAGb7gRKSQYjTAGYxK61YDmD0KaM4ZKAnNzZ1nc8wxKCPo3bsQrlcB2Wdq/j8WDB2ksVvA2rMeZvpxIJwgdKz9qxZGOSbS+ZFogUyAMsbBJDARhQBDF2PkCWmuEAKkk/pkz1J5+chWA/m1X4QwMoBONcl1mv/1NolYLA5S2bGHk9jcTdjsp0lojtaQYS6YcRd6SVLoBh0/NsDRfQRQLRLkcTQSLzSYn9u1l/uws1WYTs26atjZ0EiNV0hwPjI7NJTMDkAaTpu5WJh/3SI6u7+OWy6t8O1IR12u0jhxaBaCwcQOlK69NzUBZdOZOc/KbD2DCEGFZXPWpf09hcpqo20rzbylQMm1UOknC5MgQa6+9moX5CidOzTDrd6lqWNaa+bkKS4tLLM0v0LEd6ommoTVx6I82THgsQWMu0ZckRQHLyk0GqCWTJCzPnUUUCggpMRiEVOg4pPLYw/hz50ZnLnvXu8lMTKDjCOG6HPqDz1I7fLDnBya5+Ut3M/T6W4mjLsQRSRzR7frElmLsttvZdOc/YHLNBKrbpVWr0zWGGEEYRXS7XYJul1gpusb0tCBSLd1dXDGBS+EHpBAgETjKG2gK75g0UK8v4ycJXrGUFkKAsGxazx+lvn//KgADV29n7I1vQToOUkiSoMMTv/6v6ZxNW+190+t5w1/eyzX/4b8yfMsb6bvqWkqvv4UtH/tXbP34RzFGkyv0kWs0yLZbWDLNPJTjrJKlUikEkBhDkBgZ6jhO9DkVvigfCFj0iEtbCIHV1xZJkygKqS4sMDo+QXt5CSElUlnEfodTD3ydwuYtZCfGAdj0sU9QP7ifyqO7ULZL/ehz7P7wh7j+c39A4fJNWK7L5vd/kPXv/yCdsE2cROg4Iep0UJZN88RJlh/aScHvkFiKlnHIDA0ipEwTsbjHSAjQGBEYbbTRGCMvvstkeiYgjEEhle0Uy7FBkyRUzp4msh3cfCHNYjBI12Xue9+hsvP7qzdxCgW2/6fPUNx6JUkcYjke9YN72PUr7+Lsd/+OqLpMHMfESQBRDEGEiWJs10OHIQf+8AssPLKbrOvQl8QMrZumuHYdCAlCoLt+L5NMv3mWMmaFxLloEwD1ketv/3R3fgmDITayvxrUnsmYaNyPI5TrUR4ZJVispImxlCRRl/rBgxQ2bCJ32WXpCFp/P8Wt26nufYbu/CzKcoj9Fqf/5n6W9jyDsB2STgcTxyTdLkFlgdrevRz5iy9y9nvfwXI9lBDIKGT9L7+L0vbtJHGMdBzmHtpJ5+RxpFKASKRTPF3GW2sJedFdJm+kjJVS3AaJwFOWpe2BLrqFiSJmZ05SKg/iDgzSWVxAKIXlZWifOsahP/0C7uAgxS1bMED5qm287ve/wJ7f/k2qe55MWVjPo/L4Q8ztfhDLy2ENDIHnETRqhLVltAAnl8cYQ9RuMXbDLWx95zsJXI+lxSUaS1UaB59DSAkGpMRYQspz2efFN1rVh6/b8enu3GKKphFSC5VvdGvHPREP+WFIYmBgzRRJfRmTxKlgjkPz8AHCeoPi1itwSyUMkCmXGbnjTqKlZbq1lBwVykqLJCmI/BZRs4ZJEqTnIm0HE0XoOKZ/01au+q1PUdq8BZHEeP39nPjbbzO3+6HVhoqQVuzYpeoAzkTqMC9eA9RHrrt9FQABJBp7OY6PWkljKtEJ7a6Pky9SHBggqi2vjhtJ12V5z1OE9Tp90xvxBgfRgJPNMn7nm8mv3UCwXEXrhMTvosMoRV306oc4AaNxymWGb7yZ7Z/6bcpXb0d3uzjZLEnb5+if/xndxQrI1OEZJ1Mvy1K+T1p56xI0Wr2RwR4r3IsJEsgqyxrIDF4xH1YfK6vmDfVul1PHDmNfvoX88Bj+3FmQIITEKRY5ff/XCJaX2fxrn2D45ptXWoSM33EH5ZtuYvGxx1h45GGqh/YTNOqYOG2qSNshMzLO+Ft/juFbbsYu9hG3WyjbQboeM1/+Y+KjhyhYFgGCSBvTsXLHslq8TsiVMGYuuhy0Vj1sb2ctoShYmf6aN55rdI5WMkoPtxp1Thx/nvXrN2Jlc8SdlPMXUmH1Fajs/Hs6p2fY8onfYOTWHXiDZTSgMhnGb7+dsdtvTzu3C4skQYABVDaDOzyIk8kTBT5Ju4PlZRHS4vg3vs7M176CrTVKKSwDgRAiFBnfRiHTGu4S+ABQH772tk935xbPVXorP4XVX02SPSJujlsS1e506EYxpeFhRBiik2g1xZWOS7BUobJrF/7SAna+gNVXwPbctF2OQbkebqmENzREZmgIu7+AwJDEIVJZWJkMUa3Byfu/wcH//oeEy1WUZSOFQBloOtn5nCkW+oVddKS8JIMXmdHBHiv8gikPG0le2c5obuzms8Y8rIKzNztC2wuVWWKtmRoZIdOyiNutcxxBJoeOA07+9T2c+e636bt8E+NvfDNDt7yBzOQkXrGI4FzbXCIxtkfQadE8dYL5nTuZ+c43qe3fh9EG6bgrHQ5ipWjTf3hYW7cqKS6N+q9SYlxIZqw0Djyl6Me1ouzIdfPED8fBwo1KCK+yME8nCJgsD1LyMpigi0lJH6SyEBlF3G5S/eGjNA4e4OS3/jfuwCB9a9eTu2wd7tAQ2BaJ38Wfm6P67NO0Z0/TnpkhaNRTMsa20qEnUl9zktzjQ4m7zbMUSqwSdZdk3kgA7P7QvzPVPQd+xD5io2knEYuh35rrzD7hB/M322gnSAyO5zFZ6GPCkthJQtpr6d2293RJEmHitMEibQeVzSI9DyMlJkmjQ9RuYYxGKhssuze9ZtAIhICTInNKJaVwQmU35C0HW0guxRq4egs3f+k/p6OyF1QH5w0RW0BWKAZtLy+zo68/LeSjzaByo7S0UwtCGtUaC67DOsei35IIqTAIRI+tVJYDVsoKrSQ7ptVMBydEmlkqxznXfO0xSACWlBzv6hlUvjqs3Ksz0uqNtV6iM1u9+1grqvBi016WEGSEYsDysiozcssxeLgWLV1pCT3ga81MELIUhowqyZRjUbBtpGWhVzjBnn0IIZBS9thm0TM8cQ7/ntZJQEuLPZ34YF4MxCMie3VO2li9ttelUX7OG6DurV0fuMtUnz7woh+OjcFPYmpJEJ0Nagcq4VIYa/96MMQaBIYchhElGHUsiraFpSykSrVihR1emR8y4pymaWNIeqM38xoWI+ehoiisGbZz6woqbWMrcekG7gau2cIb/tdnLjwvsLoFL9JVtYCMtBBgO+7AVf0quzwfNXZX4+qoJcLpxEDDCJqJYaYTkSekbEkGbEVGKWwpkEKmHGOPcTYYAg2+MTSQzGrrUF4Ul4dl/qqy7RVzyn51Tc9XkwD8uCMzD73vLlN9+rmXvE4bTWQ0vk5oJZGuxf7cQtw8VksaxcQE20Qv7ifp7ByOMLiADdgCFOnAlBaCREhCKemgTudk39FRVdhYVpnxPmULT1rYQr7qcbqX3/2t3Hr3Z8SLHpp66H3/1iw99dzLj6saQ6ATujqho+Oko6NwMW4fbml/uWX8ckK03kDWrOT/vZ1Pp8UEBtq2tg8NkPWHVHa6X2WG88pWGamwpcLqzfVcylW+diu33v274mWPze1872++AhBSr51giLQmNAmBToyvE9PSweJy4h/3CbsJGiOMBESqE1IrI/CwM0MqO11U7mBGWrhS4Uq1qiGXesS2fO1Wbvurz4pXfHBy56988mVBOG+mD2PSvCEyKRih1sQmfZkXhlchsYTEkwpHqlTVe9Ojl1rwVeHv+T3xqo/O/uA9nzQAS0/tf+UHmMy5qKH5UeJipdkiEVhiRej/X4JfAcCOe39PXNTh6Qff829WZVh6cv8rdLKGF8vYxY9M7VxCoa+7YvX97ff+vrgkp8dfDIyfxvVKhD5//T97CvBbdO3BqgAAAABJRU5ErkJggg==",
      mode: "background"
    },
    {
      id: "toggle-fullscreen",
      name: "Toggle Fullscreen",
      description: "Enter or leave native fullscreen for the front window.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "make-larger",
      name: "Make Larger",
      description: "Grow the front window by 10% around its center.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "make-smaller",
      name: "Make Smaller",
      description: "Shrink the front window by 10% around its center.",
      icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAD5UlEQVR42u1bTW8bVRQ9983zR1uTWjEKhNahCAk2fCSOEBKCwob/gAhJGhBiwX9h10WFIE1DEP+BDbSAhFDSCNgi0iZVRNRETgtK3Pjdw2Lsiat6xo7ahWee72rkO3qac+bec+97nis4of258x0xwPbK2Adykvv7uvmPnW8j0PcaW4OMHyOF89H1q2MfymMR8Ps/y0wD6F5kvPbMrJyYgPXtJd5rbCILNlKoYnJ8Xvom4Ob2Ivcbt5ElO1uYwNT4gvQkYG37K+4fZgt8REJxArXxTySWgNU7X7J+eAtZtnLxeUyf+1QeIeC3O1dYP9yAD1YuXsAb5z4TALDtH1UdVJ0XBHTiFAD4dfMy6wd/wycrn3oBb1Y/FwsApIPSeUUAW3gtACjVOwKUGqbAzxtfcO/gL/hoo6dehFUQSnpJgIKwoEb54J1RYUkFW/ngHX4qrJJQ9ZMAJWF9LIGdpdASCsJTAqCwVIKepgCVYQSoryIIhfWxC+zsBodlEGRPAtwRHxz+p3USFIEMPrDwOYtnTDnIST7pxp4RQCV2t93G+vfN+9qkiMHA981UiM0Zvv6+rVeeMy+JkYRGCIwVQRJwTcX+3aN/794y02nZMjjnUCqdxv29xtrIGBFYA5HYvQDBGGRUwjmFcy5QsgFKgSlggSSa7uiBcy5wDjAGQLco6JUCZNgjqNOYFQbXBCLqFFQBCYDSPQWYIIJtX1q3y9p6/ngCCMuE8wAy9BHpJKCNTUkIu/v7igCktU9ovf3kCEgSwZYvnRnAFvgWPnbHZ0MPYxc59pHtBQda/ERC0NFrS8bXVwQ4p44qBedcavoAquSdU0dKcgSEXMUTAABnRmxp4uXSas4WJC0k2Jxh6ezBU4CLJwAM/xeIU3kKAEOUntYLz07u1JtHoDYHXxAlEOQLRopllGEMKBKbBvZYJrt/PBAYoHha8ibQMeeIVFREIYJAkS8ECAwgiHnuXlWgzUKQExRMkLo6YAIBBIkpbhMC4NHFUrnnT/aFIpjSTu9JdIq2U+19tEQR9OBMbJgCvatApgMgqgK+EjDUgHA36KsGhLtBeKwBGGrAsAwORRAe4wdbn8qu/PIxt/bWvcJ+fnQSM299LdGJkG860MZrjw9O6V34Ax3zAss/XeLW3k1Pwn8Ks29ffXhewKc06MT50DnXtRtz3Mx4FFRHpzD3zjWJHZpaujHHzd21bIKv1DDfAT52bG7p+mzmSKhWapi/uCx9D05evf5RZkioVmq4dPEbOfHo7OKPMwSAtBJRrdQAAAvvrshjDU8v/jATyebt3dWBBj1RmY6uF95bkScyPR5HxiBaP6A77X8//rm+2fqFZgAAAABJRU5ErkJggg==",
      mode: "background"
    },
    {
      id: "maximize-height",
      name: "Maximize Height",
      description: "Stretch the front window to the full screen height.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "maximize-width",
      name: "Maximize Width",
      description: "Stretch the front window to the full screen width.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "move-left",
      name: "Move Left",
      description: "Nudge the front window 50 px left.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "move-right",
      name: "Move Right",
      description: "Nudge the front window 50 px right.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "move-up",
      name: "Move Up",
      description: "Nudge the front window 50 px up.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "move-down",
      name: "Move Down",
      description: "Nudge the front window 50 px down.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "next-display",
      name: "Next Display",
      description: "Move the front window to the next display, keeping its relative size and position.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "previous-display",
      name: "Previous Display",
      description: "Move the front window to the previous display.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "top-center-sixth",
      name: "Top Center Sixth",
      description: "Front window \u2192 top center sixth of the screen.",
      icon: "data:image/png;base64,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",
      mode: "background"
    },
    {
      id: "bottom-center-sixth",
      name: "Bottom Center Sixth",
      description: "Front window \u2192 bottom center sixth of the screen.",
      icon: "data:image/png;base64,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",
      mode: "background"
    }
  ]
};

// src/worker.ts
var OSA = "/usr/bin/osascript";
var q = (s) => '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
var SystemPlus = class {
  ctx;
  shell;
  feedback;
  log;
  async initialize(ctx) {
    this.ctx = ctx;
    this.shell = ctx.getService("shell");
    this.feedback = ctx.getService("feedback");
    this.log = ctx.getService("log");
  }
  async activate() {
  }
  async deactivate() {
  }
  /** Run a program, collect stdout, reject on non-zero exit. */
  run(program, args) {
    return new Promise((resolve, reject) => {
      const h = this.shell.spawn({ program, args });
      let out = "";
      let err = "";
      h.onChunk((c) => {
        if (c.stream === "stdout") out += c.data + "\n";
        else err += c.data + "\n";
      });
      h.onDone((code) => code === 0 || code === void 0 ? resolve(out.trim()) : reject(new Error(err.trim() || `${program} exited ${code}`)));
      h.onError((e) => reject(new Error(e.message)));
    });
  }
  osa(script) {
    return this.run(OSA, ["-e", script]);
  }
  hud(t) {
    return this.feedback.showHUD(t);
  }
  focusTimer;
  /** Do Not Disturb has no public CLI. State = a `storeAssertionRecords` entry for the default DND mode in
   *  ~/Library/DoNotDisturb/DB/Assertions.json; switching runs the user's "Do Not Disturb On" / "Do Not Disturb Off"
   *  Shortcuts (each = the Shortcuts "Set Focus" action). Missing shortcut → HUD recipe + open Shortcuts. */
  async dndActive() {
    const py = "import json,os;d=json.load(open(os.path.expanduser('~/Library/DoNotDisturb/DB/Assertions.json')))['data'][0];print(int(any(r.get('assertionDetails',{}).get('assertionDetailsModeIdentifier')=='com.apple.donotdisturb.mode.default' for r in d.get('storeAssertionRecords',[]))))";
    const out = await this.osa(`do shell script ${q(`/usr/bin/python3 -c ${JSON.stringify(py)}`)}`).catch(() => "0");
    return out.trim() === "1";
  }
  async dnd(mode) {
    const on = mode === "toggle" ? !await this.dndActive() : mode === "on";
    const name = on ? "Do Not Disturb On" : "Do Not Disturb Off";
    try {
      await this.osa(`do shell script ${q(`/usr/bin/shortcuts run ${JSON.stringify(name)} </dev/null 2>&1`)}`).then((out) => {
        if (/Couldn.t find shortcut/i.test(out)) throw new Error(out);
      });
    } catch {
      await this.hud(`Create a Shortcut named "${name}" (Set Focus \u2192 Do Not Disturb)`);
      await this.run("/usr/bin/open", ["-a", "Shortcuts"]).catch(() => {
      });
      return null;
    }
    return on;
  }
  // ---- Window management extras (Raycast parity). The launcher is a non-activating panel, so the
  //      frontmost process is still the user's app; System Events reads/writes its window bounds.
  // ---- Window management extras (Raycast parity) via bin/axwin (Accessibility API on the app owning the
  //      topmost normal window; asyar's own panel is excluded). Needs Accessibility for asyar.
  axwin(...args) {
    return this.run("/Users/nassimlecornet/Library/Application Support/org.asyar.app/extensions/com.nassim.systemplus/bin/axwin", args).then((r) => {
      this.log.info(`[system+] axwin ${args.join(" ")} \u2192 ${r.trim()}`);
      const [app, x, y, w, h] = r.trim().split("|");
      if (!(+w > 0 && +h > 0)) throw new Error(`${app}: window has no size`);
      return { app, x: +x, y: +y, w: +w, h: +h };
    });
  }
  frontWindow() {
    return this.axwin("get");
  }
  async setFrontWindow(x, y, w, h) {
    await this.axwin("set", String(Math.round(x)), String(Math.round(y)), String(Math.round(w)), String(Math.round(h)));
  }
  /** Visible frames of every display in top-left window coordinates (menu bar excluded). */
  async screens() {
    const js = `ObjC.import("AppKit");const S=$.NSScreen.screens;const main=S.objectAtIndex(0).frame;const out=[];for(let i=0;i<S.count;i++){const f=S.objectAtIndex(i).visibleFrame;out.push({x:f.origin.x,y:main.size.height-(f.origin.y+f.size.height),w:f.size.width,h:f.size.height})}JSON.stringify(out)`;
    return JSON.parse(await this.run(OSA, ["-l", "JavaScript", "-e", js]));
  }
  screenOf(win, screens) {
    const cx = win.x + win.w / 2, cy = win.y + win.h / 2;
    const i = screens.findIndex((s) => cx >= s.x && cx < s.x + s.w && cy >= s.y && cy < s.y + s.h);
    return i >= 0 ? i : 0;
  }
  async resizeAround(factor) {
    const f = await this.frontWindow();
    const w = f.w * factor, h = f.h * factor;
    await this.setFrontWindow(f.x - (w - f.w) / 2, f.y - (h - f.h) / 2, w, h);
  }
  async nudge(dx, dy) {
    const f = await this.frontWindow();
    await this.setFrontWindow(f.x + dx, f.y + dy, f.w, f.h);
  }
  async toDisplay(step) {
    const f = await this.frontWindow();
    const sc = await this.screens();
    if (sc.length < 2) {
      await this.hud("Only one display");
      return;
    }
    const from = sc[this.screenOf(f, sc)], to = sc[(this.screenOf(f, sc) + step + sc.length) % sc.length];
    const rx = (f.x - from.x) / from.w, ry = (f.y - from.y) / from.h, rw = Math.min(1, f.w / from.w), rh = Math.min(1, f.h / from.h);
    await this.setFrontWindow(to.x + rx * to.w, to.y + ry * to.h, rw * to.w, rh * to.h);
  }
  async sixth(row) {
    const f = await this.frontWindow();
    const sc = await this.screens();
    const s = sc[this.screenOf(f, sc)];
    await this.setFrontWindow(s.x + s.w / 3, row === "top" ? s.y : s.y + s.h / 2, s.w / 3, s.h / 2);
  }
  async maxAxis(axis) {
    const f = await this.frontWindow();
    const sc = await this.screens();
    const s = sc[this.screenOf(f, sc)];
    if (axis === "h") await this.setFrontWindow(f.x, s.y, f.w, s.h);
    else await this.setFrontWindow(s.x, f.y, s.w, f.h);
  }
  async volume() {
    return Number(await this.osa("output volume of (get volume settings)")) || 0;
  }
  async setVolume(n) {
    await this.osa(`set volume output volume ${Math.max(0, Math.min(100, n))}`);
    await this.hud(`Volume ${Math.max(0, Math.min(100, n))}%`);
  }
  async executeCommand(commandId) {
    try {
      switch (commandId) {
        case "empty-trash": {
          const warn = this.ctx.preferences.warnBeforeEmptyingTrash !== false;
          const count = Number(await this.osa('tell application "Finder" to count items of trash')) || 0;
          if (count === 0) {
            await this.hud("Trash is already empty");
            return;
          }
          if (warn) {
            const r = await this.osa(`display dialog ${q(`Are you sure you want to permanently erase the ${count} item${count === 1 ? "" : "s"} in the Trash?`)} with title "Empty Trash" buttons {"Cancel", "Empty Trash"} default button "Empty Trash" cancel button "Cancel" with icon caution`).catch(() => "cancel");
            if (!/Empty Trash/.test(r)) return;
          }
          await this.osa('tell application "Finder" to empty trash');
          await this.hud("Trash Emptied");
          return;
        }
        case "open-trash":
          await this.run("/usr/bin/open", [`${await this.osa("POSIX path of (path to home folder)")}.Trash`]);
          return;
        case "sleep-displays":
          await this.run("/usr/bin/pmset", ["displaysleepnow"]);
          return;
        case "show-screen-saver":
          await this.run("/usr/bin/open", ["-a", "ScreenSaverEngine"]);
          return;
        case "show-desktop":
          await this.osa('tell application "System Events" to set visible of every process whose visible is true and name is not "Finder" to false');
          await this.osa('tell application "Finder" to activate');
          return;
        case "hide-all-except-frontmost":
          await this.osa('tell application "System Events" to set visible of every process whose frontmost is false and name is not "Finder" to false');
          await this.hud("Other apps hidden");
          return;
        case "quit-all-apps":
        case "quit-all-except-frontmost": {
          const keepFront = commandId === "quit-all-except-frontmost";
          const script = `tell application "System Events"
  set apps to name of every process whose background only is false and name is not "Finder" and name is not "asyar"${keepFront ? " and frontmost is false" : ""}
end tell
repeat with a in apps
  try
    tell application a to quit
  end try
end repeat
return count of apps`;
          const n = await this.osa(script);
          await this.hud(`Quit ${n} app${n === "1" ? "" : "s"}`);
          return;
        }
        case "eject-all-disks": {
          const n = await this.osa('tell application "Finder"\n set ds to every disk whose ejectable is true\n set c to count of ds\n eject ds\n return c\nend tell');
          await this.hud(n === "0" ? "No disks to eject" : `Ejected ${n} disk${n === "1" ? "" : "s"}`);
          return;
        }
        case "toggle-mute": {
          const muted = await this.osa("output muted of (get volume settings)") === "true";
          await this.osa(`set volume output muted ${!muted}`);
          await this.hud(muted ? "Unmuted" : "Muted");
          return;
        }
        case "volume-up":
          await this.setVolume(await this.volume() + 10);
          return;
        case "volume-down":
          await this.setVolume(await this.volume() - 10);
          return;
        case "volume-0":
          await this.setVolume(0);
          return;
        case "volume-25":
          await this.setVolume(25);
          return;
        case "volume-50":
          await this.setVolume(50);
          return;
        case "volume-75":
          await this.setVolume(75);
          return;
        case "volume-100":
          await this.setVolume(100);
          return;
        case "toggle-appearance": {
          const dark = await this.osa('tell application "System Events" to tell appearance preferences\n set dark mode to not dark mode\n return dark mode\nend tell');
          await this.hud(dark === "true" ? "Dark Mode" : "Light Mode");
          return;
        }
        case "toggle-hidden-files": {
          const cur = (await this.run("/usr/bin/defaults", ["read", "com.apple.finder", "AppleShowAllFiles"]).catch(() => "0")).trim().toUpperCase();
          const next = cur === "1" || cur === "TRUE" || cur === "YES" ? "FALSE" : "TRUE";
          await this.run("/usr/bin/defaults", ["write", "com.apple.finder", "AppleShowAllFiles", "-bool", next]);
          await this.run("/usr/bin/killall", ["Finder"]);
          await this.hud(next === "TRUE" ? "Hidden files shown" : "Hidden files hidden");
          return;
        }
        case "toggle-stage-manager": {
          const cur = (await this.run("/usr/bin/defaults", ["read", "com.apple.WindowManager", "GloballyEnabled"]).catch(() => "0")).trim();
          const next = cur === "1" ? "false" : "true";
          await this.run("/usr/bin/defaults", ["write", "com.apple.WindowManager", "GloballyEnabled", "-bool", next]);
          await this.hud(next === "true" ? "Stage Manager on" : "Stage Manager off");
          return;
        }
        case "toggle-bluetooth": {
          const ok = await this.run("/usr/bin/osascript", ["-e", 'do shell script "test -x /opt/homebrew/bin/blueutil && /opt/homebrew/bin/blueutil -p toggle && /opt/homebrew/bin/blueutil -p"']).catch(() => null);
          if (ok === null) {
            await this.ctx.getService("opener").openPath("x-apple.systempreferences:com.apple.BluetoothSettings").catch(() => this.run("/usr/bin/open", ["x-apple.systempreferences:com.apple.BluetoothSettings"]));
            return;
          }
          await this.hud(ok.trim() === "1" ? "Bluetooth on" : "Bluetooth off");
          return;
        }
        case "dismiss-notifications":
          await this.osa('tell application "System Events" to tell process "NotificationCenter"\n try\n click (every button of every group of every scroll area of every window whose description is "Clear All" or name is "Clear All")\n end try\nend tell').catch(() => {
          });
          await this.osa('tell application "System Events" to tell process "NotificationCenter" to try\n perform action "AXPress" of (every button whose description contains "Clear" or description contains "Close") of (every window)\nend try').catch(() => {
          });
          return;
        case "toggle-do-not-disturb": {
          const on = await this.dnd("toggle");
          if (on !== null) await this.hud(on ? "Do Not Disturb on" : "Do Not Disturb off");
          return;
        }
        case "start-focus-session": {
          const mins = Math.max(1, Number(this.ctx.preferences.values.focusMinutes) || 25);
          if (this.focusTimer) {
            clearTimeout(this.focusTimer);
            this.focusTimer = void 0;
          }
          await this.osa('tell application "System Events" to set visible of every process whose frontmost is false and name is not "Finder" to false').catch(() => {
          });
          await this.dnd("on");
          this.focusTimer = setTimeout(() => {
            void (async () => {
              this.focusTimer = void 0;
              await this.dnd("off");
              await this.feedback.sendBackground({ title: "Focus session complete", body: `${mins} minutes are up. Nice work.` }).catch(() => {
              });
            })();
          }, mins * 6e4);
          await this.hud(`Focus: ${mins} min`);
          return;
        }
        case "end-focus-session": {
          if (this.focusTimer) {
            clearTimeout(this.focusTimer);
            this.focusTimer = void 0;
          }
          await this.dnd("off");
          await this.hud("Focus session ended");
          return;
        }
        case "toggle-fullscreen":
          await this.axwin("fullscreen");
          return;
        case "make-larger":
          await this.resizeAround(1.1);
          return;
        case "make-smaller":
          await this.resizeAround(1 / 1.1);
          return;
        case "maximize-height":
          await this.maxAxis("h");
          return;
        case "maximize-width":
          await this.maxAxis("w");
          return;
        case "move-left":
          await this.nudge(-50, 0);
          return;
        case "move-right":
          await this.nudge(50, 0);
          return;
        case "move-up":
          await this.nudge(0, -50);
          return;
        case "move-down":
          await this.nudge(0, 50);
          return;
        case "next-display":
          await this.toDisplay(1);
          return;
        case "previous-display":
          await this.toDisplay(-1);
          return;
        case "top-center-sixth":
          await this.sixth("top");
          return;
        case "bottom-center-sixth":
          await this.sixth("bottom");
          return;
        default:
          this.log.warn(`[system+] unknown command ${commandId}`);
      }
    } catch (e) {
      this.log.error(`[system+] ${commandId}: ${e.message}`);
      if (/assistive access|not allowed assistive|-25211/.test(e.message)) {
        await this.hud("Grant Accessibility to Asyar (System Settings \u2192 Privacy & Security \u2192 Accessibility)");
        await this.run("/usr/bin/open", ["x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"]).catch(() => {
        });
        return void 0;
      }
      this.log.error(`[system+] ${commandId}: ${e.message}`);
      await this.feedback.sendBackground({ title: "System+", body: `${commandId}: ${e.message.slice(0, 200)}` }).catch(() => {
      });
    }
    return void 0;
  }
  onUnload = () => {
  };
};
var extensionId = window.location.hostname === "localhost" || window.location.hostname === "asyar-extension.localhost" ? window.location.pathname.split("/").filter(Boolean)[0] || "com.nassim.systemplus" : window.location.hostname || "com.nassim.systemplus";
var workerContext = new ExtensionContext2();
workerContext.setExtensionId(extensionId);
var impl = new SystemPlus();
extensionBridge.registerManifest(manifest_default);
extensionBridge.registerExtensionImplementation(extensionId, impl);
extensionBridge.initializeExtensions();
