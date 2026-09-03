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
  version: "1.0.0",
  description: "Raycast's System commands for Asyar: Empty Trash, Open Trash, Sleep Displays, Screen Saver, Show Desktop, Hide/Quit apps, Eject Disks, Volume, Appearance, Hidden Files, Stage Manager.",
  author: "Nassim Lecornet",
  icon: "icon:settings",
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
      "/usr/bin/open"
    ]
  },
  preferences: [
    {
      name: "warnBeforeEmptyingTrash",
      type: "checkbox",
      title: "Show Warning Before Emptying Trash",
      description: "Ask for confirmation before the Trash is emptied.",
      default: true
    }
  ],
  commands: [
    {
      id: "empty-trash",
      name: "Empty Trash",
      description: "Empty the Trash.",
      icon: "icon:trash",
      mode: "background"
    },
    {
      id: "open-trash",
      name: "Open Trash",
      description: "Open the Trash in Finder.",
      icon: "icon:folder",
      mode: "background"
    },
    {
      id: "sleep-displays",
      name: "Sleep Displays",
      description: "Put the displays to sleep.",
      icon: "icon:moon",
      mode: "background"
    },
    {
      id: "show-screen-saver",
      name: "Show Screen Saver",
      description: "Start the screen saver.",
      icon: "icon:sparkles",
      mode: "background"
    },
    {
      id: "show-desktop",
      name: "Show Desktop",
      description: "Hide every app and show the desktop.",
      icon: "icon:layers",
      mode: "background"
    },
    {
      id: "hide-all-except-frontmost",
      name: "Hide All Apps Except Frontmost",
      description: "Hide every app except the one in front.",
      icon: "icon:eye",
      mode: "background"
    },
    {
      id: "quit-all-apps",
      name: "Quit All Apps",
      description: "Quit every open application.",
      icon: "icon:power",
      mode: "background"
    },
    {
      id: "quit-all-except-frontmost",
      name: "Quit All Apps Except Frontmost",
      description: "Quit every app except the one in front.",
      icon: "icon:power",
      mode: "background"
    },
    {
      id: "eject-all-disks",
      name: "Eject All Disks",
      description: "Eject every ejectable disk.",
      icon: "icon:server",
      mode: "background"
    },
    {
      id: "toggle-mute",
      name: "Toggle Mute",
      description: "Mute or unmute the speaker.",
      icon: "\u{1F507}",
      mode: "background"
    },
    {
      id: "volume-up",
      name: "Turn Volume Up",
      description: "Raise the volume by 10%.",
      icon: "\u{1F50A}",
      mode: "background"
    },
    {
      id: "volume-down",
      name: "Turn Volume Down",
      description: "Lower the volume by 10%.",
      icon: "\u{1F509}",
      mode: "background"
    },
    {
      id: "volume-0",
      name: "Set Volume to 0%",
      description: "Set the output volume to 0%.",
      icon: "\u{1F507}",
      mode: "background"
    },
    {
      id: "volume-25",
      name: "Set Volume to 25%",
      description: "Set the output volume to 25%.",
      icon: "\u{1F508}",
      mode: "background"
    },
    {
      id: "volume-50",
      name: "Set Volume to 50%",
      description: "Set the output volume to 50%.",
      icon: "\u{1F509}",
      mode: "background"
    },
    {
      id: "volume-75",
      name: "Set Volume to 75%",
      description: "Set the output volume to 75%.",
      icon: "\u{1F50A}",
      mode: "background"
    },
    {
      id: "volume-100",
      name: "Set Volume to 100%",
      description: "Set the output volume to 100%.",
      icon: "\u{1F50A}",
      mode: "background"
    },
    {
      id: "toggle-appearance",
      name: "Toggle System Appearance",
      description: "Switch between light and dark mode.",
      icon: "icon:moon",
      mode: "background"
    },
    {
      id: "toggle-hidden-files",
      name: "Toggle Hidden Files",
      description: "Show or hide hidden files in Finder.",
      icon: "icon:folder-search",
      mode: "background"
    },
    {
      id: "toggle-stage-manager",
      name: "Toggle Stage Manager",
      description: "Turn Stage Manager on or off.",
      icon: "icon:layers",
      mode: "background"
    },
    {
      id: "toggle-bluetooth",
      name: "Toggle Bluetooth",
      description: "Turn Bluetooth on or off (uses blueutil if installed, else opens Bluetooth settings).",
      icon: "icon:activity",
      mode: "background"
    },
    {
      id: "dismiss-notifications",
      name: "Dismiss Notifications",
      description: "Clear every banner in Notification Center.",
      icon: "icon:info",
      mode: "background"
    }
  ]
};

// src/worker.ts
var OSA = "/usr/bin/osascript";
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
            const ok = await this.feedback.confirmAlert({ title: "Empty Trash?", message: `${count} item${count === 1 ? "" : "s"} will be deleted permanently.`, confirmText: "Empty Trash", cancelText: "Cancel", variant: "danger" });
            if (!ok) return;
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
        default:
          this.log.warn(`[system+] unknown command ${commandId}`);
      }
    } catch (e) {
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
