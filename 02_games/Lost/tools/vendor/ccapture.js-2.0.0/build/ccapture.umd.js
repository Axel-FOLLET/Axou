(() => {
  var __defProp = Object.defineProperty;
  var __typeError = (msg) => {
    throw TypeError(msg);
  };
  var __export = (target2, all) => {
    for (var name in all)
      __defProp(target2, name, { get: all[name], enumerable: true });
  };
  var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
  var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
  var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
  var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
  var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
  var __privateWrapper = (obj, member, setter, getter) => ({
    set _(value) {
      __privateSet(obj, member, value, setter);
    },
    get _() {
      return __privateGet(obj, member, getter);
    }
  });

  // src/index.js
  var src_exports = {};
  __export(src_exports, {
    BatchEncoder: () => BatchEncoder,
    CCapture: () => CCapture,
    FrameEncoder: () => FrameEncoder,
    FrameWrap: () => FrameWrap,
    GIFEncoder: () => GIFEncoder,
    GPUMotionBlur: () => GPUMotionBlur,
    GifskiEncoder: () => GifskiEncoder,
    MotionBlur: () => MotionBlur,
    TimeWarp: () => TimeWarp,
    WebCodecsEncoder: () => WebCodecsEncoder,
    createMotionBlur: () => createMotionBlur,
    default: () => src_default,
    encoders: () => encoders,
    nextTask: () => nextTask,
    renderAudioFrames: () => renderAudioFrames
  });

  // src/MotionBlur.js
  var _MotionBlur_instances, ensureSize_fn;
  var MotionBlur = class {
    constructor() {
      __privateAdd(this, _MotionBlur_instances);
      this.canvas = document.createElement("canvas");
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
      this.accum = null;
      this.width = 0;
      this.height = 0;
      this.count = 0;
    }
    /** Add one sub-frame to the accumulator. */
    add(source) {
      __privateMethod(this, _MotionBlur_instances, ensureSize_fn).call(this, source.width, source.height);
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.ctx.drawImage(source, 0, 0);
      const { data } = this.ctx.getImageData(0, 0, this.width, this.height);
      const accum = this.accum;
      for (let i = 0; i < accum.length; i++) accum[i] += data[i];
      this.count++;
    }
    /** Resolve the average into `this.canvas` and return it. */
    resolve() {
      const image = this.ctx.createImageData(this.width, this.height);
      const data = image.data;
      const accum = this.accum;
      const n = this.count || 1;
      for (let i = 0; i < accum.length; i++) data[i] = accum[i] / n;
      this.ctx.putImageData(image, 0, 0);
      return this.canvas;
    }
    /** Clear the accumulator for the next output frame. */
    reset() {
      if (this.accum) this.accum.fill(0);
      this.count = 0;
    }
    /** No GPU resources to free; present for interface parity with GPUMotionBlur. */
    dispose() {
    }
  };
  _MotionBlur_instances = new WeakSet();
  ensureSize_fn = function(width, height) {
    if (this.width === width && this.height === height && this.accum) return;
    this.width = this.canvas.width = width;
    this.height = this.canvas.height = height;
    this.accum = new Float32Array(width * height * 4);
    this.count = 0;
  };

  // src/GPUMotionBlur.js
  var _supported;
  var QUAD = new Float32Array([-1, -1, 3, -1, -1, 3]);
  var VERT = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;
  var FRAG_ACCUM = `#version 300 es
precision highp float;
uniform sampler2D src;
in vec2 vUv;
out vec4 fragColor;
void main() { fragColor = texture(src, vUv); }`;
  var FRAG_RESOLVE = `#version 300 es
precision highp float;
uniform sampler2D accum;
uniform float scale;
in vec2 vUv;
out vec4 fragColor;
void main() { fragColor = vec4(texture(accum, vUv).rgb * scale, 1.0); }`;
  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error("[GPUMotionBlur] shader: " + gl.getShaderInfoLog(shader));
    }
    return shader;
  }
  function program(gl, vert, frag) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vert));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, "position");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error("[GPUMotionBlur] link: " + gl.getProgramInfoLog(p));
    }
    return p;
  }
  var _GPUMotionBlur_instances, ensureSize_fn2;
  var GPUMotionBlur = class {
    constructor() {
      __privateAdd(this, _GPUMotionBlur_instances);
      this.canvas = document.createElement("canvas");
      const gl = this.canvas.getContext("webgl2", {
        premultipliedAlpha: false,
        preserveDrawingBuffer: true
        // so the encoder can read the resolved frame
      });
      if (!gl || !gl.getExtension("EXT_color_buffer_float")) {
        throw new Error("[GPUMotionBlur] WebGL2 + EXT_color_buffer_float required");
      }
      this.gl = gl;
      this.accumProgram = program(gl, VERT, FRAG_ACCUM);
      this.resolveProgram = program(gl, VERT, FRAG_RESOLVE);
      this.srcLoc = gl.getUniformLocation(this.accumProgram, "src");
      this.accumLoc = gl.getUniformLocation(this.resolveProgram, "accum");
      this.scaleLoc = gl.getUniformLocation(this.resolveProgram, "scale");
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      this.srcTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      this.accumTex = null;
      this.fbo = null;
      this.width = 0;
      this.height = 0;
      this.count = 0;
    }
    static isSupported() {
      if (_supported !== void 0) return _supported;
      _supported = false;
      try {
        const c = document.createElement("canvas");
        const gl = c.getContext("webgl2");
        _supported = !!(gl && gl.getExtension("EXT_color_buffer_float"));
      } catch {
        _supported = false;
      }
      return _supported;
    }
    add(source) {
      __privateMethod(this, _GPUMotionBlur_instances, ensureSize_fn2).call(this, source.width, source.height);
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.viewport(0, 0, this.width, this.height);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.accumProgram);
      gl.uniform1i(this.srcLoc, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.count++;
    }
    resolve() {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.width, this.height);
      gl.useProgram(this.resolveProgram);
      gl.uniform1f(this.scaleLoc, 1 / (this.count || 1));
      gl.uniform1i(this.accumLoc, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.accumTex);
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      return this.canvas;
    }
    reset() {
      const gl = this.gl;
      if (this.fbo) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.viewport(0, 0, this.width, this.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      this.count = 0;
    }
    /** Free GL resources and release the WebGL context. Idempotent. */
    dispose() {
      const gl = this.gl;
      if (!gl) return;
      try {
        if (this.accumTex) gl.deleteTexture(this.accumTex);
        if (this.srcTex) gl.deleteTexture(this.srcTex);
        if (this.fbo) gl.deleteFramebuffer(this.fbo);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
      }
      this.gl = null;
      this.accumTex = null;
      this.fbo = null;
    }
  };
  _GPUMotionBlur_instances = new WeakSet();
  ensureSize_fn2 = function(width, height) {
    if (this.width === width && this.height === height && this.fbo) return;
    const gl = this.gl;
    this.width = this.canvas.width = width;
    this.height = this.canvas.height = height;
    if (this.accumTex) gl.deleteTexture(this.accumTex);
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    this.accumTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.accumTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.accumTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.reset();
  };

  // src/createMotionBlur.js
  function isWebGLCanvas(source) {
    if (!source || typeof source.getContext !== "function") return false;
    try {
      if (source.getContext("2d")) return false;
      return !!(source.getContext("webgl2") || source.getContext("webgl"));
    } catch {
      return false;
    }
  }
  function chooseBackend(source, subframes, prefer = "auto") {
    if (prefer === "cpu") return "cpu";
    const wantGPU = prefer === "gpu" || prefer === "auto" && subframes > 2 && isWebGLCanvas(source);
    return wantGPU && GPUMotionBlur.isSupported() ? "gpu" : "cpu";
  }
  function createMotionBlur(source, subframes, prefer = "auto") {
    if (chooseBackend(source, subframes, prefer) === "gpu") {
      try {
        return new GPUMotionBlur();
      } catch {
      }
    }
    return new MotionBlur();
  }

  // src/third_party/download.js
  function download(data, strFileName, strMimeType) {
    var self = window, u = "application/octet-stream", m = strMimeType || u, x = data, D2 = document, a = D2.createElement("a"), z = function(a2) {
      return String(a2);
    }, B = self.Blob || self.MozBlob || self.WebKitBlob || z, BB = self.MSBlobBuilder || self.WebKitBlobBuilder || self.BlobBuilder, fn = strFileName || "download", blob, b, ua, fr;
    if (String(this) === "true") {
      x = [x, m];
      m = x[0];
      x = x[1];
    }
    if (String(x).match(/^data\:[\w+\-]+\/[\w+\-]+[,;]/)) {
      return navigator.msSaveBlob ? navigator.msSaveBlob(d2b(x), fn) : saver(x);
    }
    try {
      blob = x instanceof B ? x : new B([x], { type: m });
    } catch (y) {
      if (BB) {
        b = new BB();
        b.append([x]);
        blob = b.getBlob(m);
      }
    }
    function d2b(u2) {
      var p = u2.split(/[:;,]/), t = p[1], dec = p[2] == "base64" ? atob : decodeURIComponent, bin = dec(p.pop()), mx = bin.length, i = 0, uia = new Uint8Array(mx);
      for (i; i < mx; ++i) uia[i] = bin.charCodeAt(i);
      return new B([uia], { type: t });
    }
    function saver(url2, winMode) {
      if ("download" in a) {
        a.href = url2;
        a.setAttribute("download", fn);
        a.innerHTML = "downloading...";
        D2.body.appendChild(a);
        setTimeout(function() {
          a.click();
          D2.body.removeChild(a);
          if (winMode === true) {
            setTimeout(function() {
              self.URL.revokeObjectURL(a.href);
            }, 250);
          }
        }, 66);
        return true;
      }
      var f = D2.createElement("iframe");
      D2.body.appendChild(f);
      if (!winMode) {
        url2 = "data:" + url2.replace(/^data:([\w\/\-\+]+)/, u);
      }
      f.src = url2;
      setTimeout(function() {
        D2.body.removeChild(f);
      }, 333);
    }
    if (navigator.msSaveBlob) {
      return navigator.msSaveBlob(blob, fn);
    }
    if (self.URL) {
      saver(self.URL.createObjectURL(blob), true);
    } else {
      if (typeof blob === "string" || blob.constructor === z) {
        try {
          return saver("data:" + m + ";base64," + self.btoa(blob));
        } catch (y) {
          return saver("data:" + m + "," + encodeURIComponent(blob));
        }
      }
      fr = new FileReader();
      fr.onload = function(e) {
        saver(this.result);
      };
      fr.readAsDataURL(blob);
    }
    return true;
  }

  // src/utils.js
  function asyncCanvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    });
  }
  function pad(n, length = 7) {
    return String(n).padStart(length, "0");
  }
  function guid() {
    const s4 = () => Math.floor((1 + Math.random()) * 65536).toString(16).substring(1);
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
  }
  var rawSetTimeout = typeof globalThis.setTimeout === "function" ? globalThis.setTimeout.bind(globalThis) : null;
  var _channel;
  var _pending;
  function nextTask() {
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && typeof MessageChannel !== "undefined") {
        if (!_channel) {
          _channel = new MessageChannel();
          _channel.port1.onmessage = () => {
            const r = _pending;
            _pending = null;
            if (r) r();
          };
        }
        _pending = resolve;
        _channel.port2.postMessage(0);
      } else if (rawSetTimeout) {
        rawSetTimeout(resolve, 0);
      } else {
        Promise.resolve().then(resolve);
      }
    });
  }

  // src/encoders/FrameEncoder.js
  var FrameEncoder = class {
    constructor(params) {
      this.params = params;
      this.filename = params.name || guid();
      this.extension = "";
      this.mimeType = "";
      this._handlers = {};
      this.frames = 0;
      this.totalFrames = 0;
      this.part = 1;
      this.autoSaveTime = params.autoSaveTime || 0;
      this.multipart = this.autoSaveTime > 0;
      this.partFrames = this.multipart ? Math.max(1, Math.round(params.framerate * this.autoSaveTime)) : 0;
    }
    /** Subscribe to encoder events (e.g. "progress"). FrameWrap forwards these. */
    on(event, handler) {
      this._handlers[event] = handler;
      return this;
    }
    emit(event, ...args) {
      const h = this._handlers[event];
      if (h) h(...args);
    }
    get name() {
      if (this.multipart) {
        return `${this.filename}-part-${String(this.part).padStart(5, "0")}.${this.extension}`;
      }
      return `${this.filename}.${this.extension}`;
    }
    async start() {
      this.frames = 0;
      this.totalFrames = 0;
      this.part = 1;
    }
    /**
     * Subclasses call `await super.add()` after consuming the frame, so
     * bookkeeping and multipart flushing happen in one place.
     */
    async add() {
      this.frames++;
      this.totalFrames++;
      if (this.multipart && this.frames >= this.partFrames) {
        const blob = await this.save();
        if (blob) download(blob, this.name, this.mimeType);
        await this.dispose();
        this.frames = 0;
        this.part++;
      }
    }
    async stop() {
    }
    /** @returns {Promise<Blob|null>} */
    async save() {
      return null;
    }
    async dispose() {
    }
  };

  // src/third_party/Tar.js
  function clean(length) {
    var i, buffer = new Uint8Array(length);
    for (i = 0; i < length; i += 1) {
      buffer[i] = 0;
    }
    return buffer;
  }
  function pad2(num, bytes2, base) {
    num = num.toString(base || 8);
    return "000000000000".substr(num.length + 12 - bytes2) + num;
  }
  function stringToUint8(input, out, offset) {
    var i, length;
    out = out || clean(input.length);
    offset = offset || 0;
    for (i = 0, length = input.length; i < length; i += 1) {
      out[offset] = input.charCodeAt(i);
      offset += 1;
    }
    return out;
  }
  var headerFormat;
  headerFormat = [
    {
      field: "fileName",
      length: 100
    },
    {
      field: "fileMode",
      length: 8
    },
    {
      field: "uid",
      length: 8
    },
    {
      field: "gid",
      length: 8
    },
    {
      field: "fileSize",
      length: 12
    },
    {
      field: "mtime",
      length: 12
    },
    {
      field: "checksum",
      length: 8
    },
    {
      field: "type",
      length: 1
    },
    {
      field: "linkName",
      length: 100
    },
    {
      field: "ustar",
      length: 8
    },
    {
      field: "owner",
      length: 32
    },
    {
      field: "group",
      length: 32
    },
    {
      field: "majorNumber",
      length: 8
    },
    {
      field: "minorNumber",
      length: 8
    },
    {
      field: "filenamePrefix",
      length: 155
    },
    {
      field: "padding",
      length: 12
    }
  ];
  function formatHeader(data, cb) {
    var buffer = clean(512), offset = 0;
    headerFormat.forEach(function(value) {
      var str = data[value.field] || "", i, length;
      for (i = 0, length = str.length; i < length; i += 1) {
        buffer[offset] = str.charCodeAt(i);
        offset += 1;
      }
      offset += value.length - i;
    });
    if (typeof cb === "function") {
      return cb(buffer, offset);
    }
    return buffer;
  }
  var header = {};
  header.structure = headerFormat;
  header.format = formatHeader;
  var recordSize = 512;
  var blockSize;
  function Tar(recordsPerBlock) {
    this.written = 0;
    blockSize = (recordsPerBlock || 20) * recordSize;
    this.out = clean(blockSize);
    this.blocks = [];
    this.length = 0;
  }
  Tar.prototype.append = function(filepath, input, opts, callback) {
    var data, checksum, mode, mtime, uid, gid, headerArr;
    if (typeof input === "string") {
      input = stringToUint8(input);
    } else if (input.constructor !== Uint8Array.prototype.constructor) {
      throw "Invalid input type. You gave me: " + input.constructor.toString().match(/function\s*([$A-Za-z_][0-9A-Za-z_]*)\s*\(/)[1];
    }
    if (typeof opts === "function") {
      callback = opts;
      opts = {};
    }
    opts = opts || {};
    mode = opts.mode || parseInt("777", 8) & 4095;
    mtime = opts.mtime || Math.floor(+/* @__PURE__ */ new Date() / 1e3);
    uid = opts.uid || 0;
    gid = opts.gid || 0;
    data = {
      fileName: filepath,
      fileMode: pad2(mode, 7),
      uid: pad2(uid, 7),
      gid: pad2(gid, 7),
      fileSize: pad2(input.length, 11),
      mtime: pad2(mtime, 11),
      checksum: "        ",
      type: "0",
      // just a file
      ustar: "ustar  ",
      owner: opts.owner || "",
      group: opts.group || ""
    };
    checksum = 0;
    Object.keys(data).forEach(function(key) {
      var i, value = data[key], length;
      for (i = 0, length = value.length; i < length; i += 1) {
        checksum += value.charCodeAt(i);
      }
    });
    data.checksum = pad2(checksum, 6) + "\0 ";
    headerArr = header.format(data);
    var headerLength = Math.ceil(headerArr.length / recordSize) * recordSize;
    var inputLength = Math.ceil(input.length / recordSize) * recordSize;
    this.blocks.push({
      header: headerArr,
      input,
      headerLength,
      inputLength
    });
  };
  Tar.prototype.save = function() {
    var buffers = [];
    var chunks = [];
    var length = 0;
    var max = Math.pow(2, 20);
    var chunk = [];
    this.blocks.forEach(function(b) {
      if (length + b.headerLength + b.inputLength > max) {
        chunks.push({ blocks: chunk, length });
        chunk = [];
        length = 0;
      }
      chunk.push(b);
      length += b.headerLength + b.inputLength;
    });
    chunks.push({ blocks: chunk, length });
    chunks.forEach(function(c) {
      var buffer = new Uint8Array(c.length);
      var written = 0;
      c.blocks.forEach(function(b) {
        buffer.set(b.header, written);
        written += b.headerLength;
        buffer.set(b.input, written);
        written += b.inputLength;
      });
      buffers.push(buffer);
    });
    buffers.push(new Uint8Array(2 * recordSize));
    return new Blob(buffers, { type: "octet/stream" });
  };
  Tar.prototype.clear = function() {
    this.written = 0;
    this.out = clean(blockSize);
  };

  // src/encoders/TarEncoder.js
  var TarEncoder = class extends FrameEncoder {
    constructor(params) {
      super(params);
      this.extension = "tar";
      this.mimeType = "application/x-tar";
      this.fileExtension = "";
      this.tape = null;
      this.count = 0;
    }
    async start() {
      await super.start();
      this.tape = new Tar();
      this.count = 0;
    }
    async add(blob) {
      const buffer = new Uint8Array(await blob.arrayBuffer());
      this.tape.append(`${pad(this.count)}.${this.fileExtension}`, buffer);
      this.count++;
      await super.add();
    }
    async save() {
      return this.frames ? this.tape.save() : null;
    }
    async dispose() {
      this.tape = new Tar();
    }
  };

  // src/encoders/ImageEncoder.js
  var ImageEncoder = class extends TarEncoder {
    constructor(params) {
      super(params);
      this.type = "image/png";
      const q2 = params.quality ?? 92;
      this.quality = Math.min(1, Math.max(0, q2 / 100));
    }
    async add(canvas) {
      const blob = await asyncCanvasToBlob(canvas, this.type, this.quality);
      if (!blob) {
        throw new Error(
          `Failed to encode a "${this.type}" frame \u2014 this browser may not support that image format via canvas.toBlob.`
        );
      }
      await super.add(blob);
    }
  };

  // src/encoders/PNGEncoder.js
  var PNGEncoder = class extends ImageEncoder {
    constructor(params) {
      super(params);
      this.type = "image/png";
      this.fileExtension = "png";
    }
  };

  // src/encoders/JPGEncoder.js
  var JPGEncoder = class extends ImageEncoder {
    constructor(params) {
      super(params);
      this.type = "image/jpeg";
      this.fileExtension = "jpg";
    }
  };

  // src/encoders/WebPEncoder.js
  var WebPEncoder = class extends ImageEncoder {
    constructor(params) {
      super(params);
      this.type = "image/webp";
      this.fileExtension = "webp";
    }
  };

  // src/third_party/webm-writer.js
  var ArrayBufferDataStream = function(length) {
    this.data = new Uint8Array(length);
    this.pos = 0;
  };
  ArrayBufferDataStream.prototype.seek = function(offset) {
    this.pos = offset;
  };
  ArrayBufferDataStream.prototype.writeBytes = function(arr) {
    for (var i = 0; i < arr.length; i++) {
      this.data[this.pos++] = arr[i];
    }
  };
  ArrayBufferDataStream.prototype.writeByte = function(b) {
    this.data[this.pos++] = b;
  };
  ArrayBufferDataStream.prototype.writeU8 = ArrayBufferDataStream.prototype.writeByte;
  ArrayBufferDataStream.prototype.writeU16BE = function(u) {
    this.data[this.pos++] = u >> 8;
    this.data[this.pos++] = u;
  };
  ArrayBufferDataStream.prototype.writeDoubleBE = function(d) {
    var bytes2 = new Uint8Array(new Float64Array([d]).buffer);
    for (var i = bytes2.length - 1; i >= 0; i--) {
      this.writeByte(bytes2[i]);
    }
  };
  ArrayBufferDataStream.prototype.writeFloatBE = function(d) {
    var bytes2 = new Uint8Array(new Float32Array([d]).buffer);
    for (var i = bytes2.length - 1; i >= 0; i--) {
      this.writeByte(bytes2[i]);
    }
  };
  ArrayBufferDataStream.prototype.writeString = function(s) {
    for (var i = 0; i < s.length; i++) {
      this.data[this.pos++] = s.charCodeAt(i);
    }
  };
  ArrayBufferDataStream.prototype.writeEBMLVarIntWidth = function(i, width) {
    switch (width) {
      case 1:
        this.writeU8(1 << 7 | i);
        break;
      case 2:
        this.writeU8(1 << 6 | i >> 8);
        this.writeU8(i);
        break;
      case 3:
        this.writeU8(1 << 5 | i >> 16);
        this.writeU8(i >> 8);
        this.writeU8(i);
        break;
      case 4:
        this.writeU8(1 << 4 | i >> 24);
        this.writeU8(i >> 16);
        this.writeU8(i >> 8);
        this.writeU8(i);
        break;
      case 5:
        this.writeU8(1 << 3 | i / 4294967296 & 7);
        this.writeU8(i >> 24);
        this.writeU8(i >> 16);
        this.writeU8(i >> 8);
        this.writeU8(i);
        break;
      default:
        throw new RuntimeException("Bad EBML VINT size " + width);
    }
  };
  ArrayBufferDataStream.prototype.measureEBMLVarInt = function(val) {
    if (val < (1 << 7) - 1) {
      return 1;
    } else if (val < (1 << 14) - 1) {
      return 2;
    } else if (val < (1 << 21) - 1) {
      return 3;
    } else if (val < (1 << 28) - 1) {
      return 4;
    } else if (val < 34359738367) {
      return 5;
    } else {
      throw new RuntimeException("EBML VINT size not supported " + val);
    }
  };
  ArrayBufferDataStream.prototype.writeEBMLVarInt = function(i) {
    this.writeEBMLVarIntWidth(i, this.measureEBMLVarInt(i));
  };
  ArrayBufferDataStream.prototype.writeUnsignedIntBE = function(u, width) {
    if (width === void 0) {
      width = this.measureUnsignedInt(u);
    }
    switch (width) {
      case 5:
        this.writeU8(Math.floor(u / 4294967296));
      // Need to use division to access >32 bits of floating point var
      case 4:
        this.writeU8(u >> 24);
      case 3:
        this.writeU8(u >> 16);
      case 2:
        this.writeU8(u >> 8);
      case 1:
        this.writeU8(u);
        break;
      default:
        throw new RuntimeException("Bad UINT size " + width);
    }
  };
  ArrayBufferDataStream.prototype.measureUnsignedInt = function(val) {
    if (val < 1 << 8) {
      return 1;
    } else if (val < 1 << 16) {
      return 2;
    } else if (val < 1 << 24) {
      return 3;
    } else if (val < 4294967296) {
      return 4;
    } else {
      return 5;
    }
  };
  ArrayBufferDataStream.prototype.getAsDataArray = function() {
    if (this.pos < this.data.byteLength) {
      return this.data.subarray(0, this.pos);
    } else if (this.pos == this.data.byteLength) {
      return this.data;
    } else {
      throw "ArrayBufferDataStream's pos lies beyond end of buffer";
    }
  };
  var BlobBuffer = function(fs) {
    return function(destination) {
      var buffer = [], writePromise = Promise.resolve(), fileWriter = null, fd = null;
      if (typeof FileWriter !== "undefined" && destination instanceof FileWriter) {
        fileWriter = destination;
      } else if (fs && destination) {
        fd = destination;
      }
      this.pos = 0;
      this.length = 0;
      function readBlobAsBuffer(blob) {
        return new Promise(function(resolve, reject) {
          var reader = new FileReader();
          reader.addEventListener("loadend", function() {
            resolve(reader.result);
          });
          reader.readAsArrayBuffer(blob);
        });
      }
      function convertToUint8Array(thing) {
        return new Promise(function(resolve, reject) {
          if (thing instanceof Uint8Array) {
            resolve(thing);
          } else if (thing instanceof ArrayBuffer || ArrayBuffer.isView(thing)) {
            resolve(new Uint8Array(thing));
          } else if (thing instanceof Blob) {
            resolve(
              readBlobAsBuffer(thing).then(function(buffer2) {
                return new Uint8Array(buffer2);
              })
            );
          } else {
            resolve(
              readBlobAsBuffer(new Blob([thing])).then(function(buffer2) {
                return new Uint8Array(buffer2);
              })
            );
          }
        });
      }
      function measureData(data) {
        var result = data.byteLength || data.length || data.size;
        if (!Number.isInteger(result)) {
          throw "Failed to determine size of element";
        }
        return result;
      }
      this.seek = function(offset) {
        if (offset < 0) {
          throw "Offset may not be negative";
        }
        if (isNaN(offset)) {
          throw "Offset may not be NaN";
        }
        if (offset > this.length) {
          throw "Seeking beyond the end of file is not allowed";
        }
        this.pos = offset;
      };
      this.write = function(data) {
        var newEntry = {
          offset: this.pos,
          data,
          length: measureData(data)
        }, isAppend = newEntry.offset >= this.length;
        this.pos += newEntry.length;
        this.length = Math.max(this.length, this.pos);
        writePromise = writePromise.then(function() {
          if (fd) {
            return new Promise(function(resolve, reject) {
              convertToUint8Array(newEntry.data).then(function(dataArray) {
                var totalWritten = 0, buffer2 = Buffer.from(dataArray.buffer), handleWriteComplete = function(err, written, buffer3) {
                  totalWritten += written;
                  if (totalWritten >= buffer3.length) {
                    resolve();
                  } else {
                    fs.write(
                      fd,
                      buffer3,
                      totalWritten,
                      buffer3.length - totalWritten,
                      newEntry.offset + totalWritten,
                      handleWriteComplete
                    );
                  }
                };
                fs.write(
                  fd,
                  buffer2,
                  0,
                  buffer2.length,
                  newEntry.offset,
                  handleWriteComplete
                );
              });
            });
          } else if (fileWriter) {
            return new Promise(function(resolve, reject) {
              fileWriter.onwriteend = resolve;
              fileWriter.seek(newEntry.offset);
              fileWriter.write(new Blob([newEntry.data]));
            });
          } else if (!isAppend) {
            for (var i = 0; i < buffer.length; i++) {
              var entry = buffer[i];
              if (!(newEntry.offset + newEntry.length <= entry.offset || newEntry.offset >= entry.offset + entry.length)) {
                if (newEntry.offset < entry.offset || newEntry.offset + newEntry.length > entry.offset + entry.length) {
                  throw new Error("Overwrite crosses blob boundaries");
                }
                if (newEntry.offset == entry.offset && newEntry.length == entry.length) {
                  entry.data = newEntry.data;
                  return;
                } else {
                  return convertToUint8Array(entry.data).then(function(entryArray) {
                    entry.data = entryArray;
                    return convertToUint8Array(newEntry.data);
                  }).then(function(newEntryArray) {
                    newEntry.data = newEntryArray;
                    entry.data.set(
                      newEntry.data,
                      newEntry.offset - entry.offset
                    );
                  });
                }
              }
            }
          }
          buffer.push(newEntry);
        });
      };
      this.complete = function(mimeType) {
        if (fd || fileWriter) {
          writePromise = writePromise.then(function() {
            return null;
          });
        } else {
          writePromise = writePromise.then(function() {
            var result = [];
            for (var i = 0; i < buffer.length; i++) {
              result.push(buffer[i].data);
            }
            return new Blob(result, { mimeType });
          });
        }
        return writePromise;
      };
    };
  };
  var WebMWriter = function(ArrayBufferDataStream2, BlobBuffer2) {
    function extend(base, top) {
      var target2 = {};
      [base, top].forEach(function(obj) {
        for (var prop in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, prop)) {
            target2[prop] = obj[prop];
          }
        }
      });
      return target2;
    }
    function decodeBase64WebPDataURL(url2) {
      if (typeof url2 !== "string" || !url2.match(/^data:image\/webp;base64,/i)) {
        return false;
      }
      return window.atob(url2.substring("data:image/webp;base64,".length));
    }
    function stringToArrayBuffer(string) {
      var buffer = new ArrayBuffer(string.length), int8Array = new Uint8Array(buffer);
      for (var i = 0; i < string.length; i++) {
        int8Array[i] = string.charCodeAt(i);
      }
      return buffer;
    }
    function renderAsWebP(canvas, quality) {
      var frame = canvas.toDataURL("image/webp", { quality });
      return decodeBase64WebPDataURL(frame);
    }
    function extractKeyframeFromWebP(webP) {
      var keyframeStartIndex = webP.indexOf("VP8 ");
      if (keyframeStartIndex == -1) {
        throw "Failed to identify beginning of keyframe in WebP image";
      }
      keyframeStartIndex += "VP8 ".length + 4;
      return webP.substring(keyframeStartIndex);
    }
    function EBMLFloat322(value) {
      this.value = value;
    }
    function EBMLFloat642(value) {
      this.value = value;
    }
    function writeEBML(buffer, bufferFileOffset, ebml) {
      if (Array.isArray(ebml)) {
        for (var i = 0; i < ebml.length; i++) {
          writeEBML(buffer, bufferFileOffset, ebml[i]);
        }
      } else if (typeof ebml === "string") {
        buffer.writeString(ebml);
      } else if (ebml instanceof Uint8Array) {
        buffer.writeBytes(ebml);
      } else if (ebml.id) {
        ebml.offset = buffer.pos + bufferFileOffset;
        buffer.writeUnsignedIntBE(ebml.id);
        if (Array.isArray(ebml.data)) {
          var sizePos, dataBegin, dataEnd;
          if (ebml.size === -1) {
            buffer.writeByte(255);
          } else {
            sizePos = buffer.pos;
            buffer.writeBytes([0, 0, 0, 0]);
          }
          dataBegin = buffer.pos;
          ebml.dataOffset = dataBegin + bufferFileOffset;
          writeEBML(buffer, bufferFileOffset, ebml.data);
          if (ebml.size !== -1) {
            dataEnd = buffer.pos;
            ebml.size = dataEnd - dataBegin;
            buffer.seek(sizePos);
            buffer.writeEBMLVarIntWidth(ebml.size, 4);
            buffer.seek(dataEnd);
          }
        } else if (typeof ebml.data === "string") {
          buffer.writeEBMLVarInt(ebml.data.length);
          ebml.dataOffset = buffer.pos + bufferFileOffset;
          buffer.writeString(ebml.data);
        } else if (typeof ebml.data === "number") {
          if (!ebml.size) {
            ebml.size = buffer.measureUnsignedInt(ebml.data);
          }
          buffer.writeEBMLVarInt(ebml.size);
          ebml.dataOffset = buffer.pos + bufferFileOffset;
          buffer.writeUnsignedIntBE(ebml.data, ebml.size);
        } else if (ebml.data instanceof EBMLFloat642) {
          buffer.writeEBMLVarInt(8);
          ebml.dataOffset = buffer.pos + bufferFileOffset;
          buffer.writeDoubleBE(ebml.data.value);
        } else if (ebml.data instanceof EBMLFloat322) {
          buffer.writeEBMLVarInt(4);
          ebml.dataOffset = buffer.pos + bufferFileOffset;
          buffer.writeFloatBE(ebml.data.value);
        } else if (ebml.data instanceof Uint8Array) {
          buffer.writeEBMLVarInt(ebml.data.byteLength);
          ebml.dataOffset = buffer.pos + bufferFileOffset;
          buffer.writeBytes(ebml.data);
        } else {
          throw "Bad EBML datatype " + typeof ebml.data;
        }
      } else {
        throw "Bad EBML datatype " + typeof ebml.data;
      }
    }
    return function(options) {
      var MAX_CLUSTER_DURATION_MSEC = 5e3, DEFAULT_TRACK_NUMBER = 1, writtenHeader = false, videoWidth, videoHeight, clusterFrameBuffer = [], clusterStartTime = 0, clusterDuration = 0, optionDefaults = {
        quality: 0.95,
        // WebM image quality from 0.0 (worst) to 1.0 (best)
        fileWriter: null,
        // Chrome FileWriter in order to stream to a file instead of buffering to memory (optional)
        fd: null,
        // Node.JS file descriptor to write to instead of buffering (optional)
        // You must supply one of:
        frameDuration: null,
        // Duration of frames in milliseconds
        frameRate: null
        // Number of frames per second
      }, seekPoints = {
        Cues: {
          id: new Uint8Array([28, 83, 187, 107]),
          positionEBML: null
        },
        SegmentInfo: {
          id: new Uint8Array([21, 73, 169, 102]),
          positionEBML: null
        },
        Tracks: {
          id: new Uint8Array([22, 84, 174, 107]),
          positionEBML: null
        }
      }, ebmlSegment, segmentDuration = {
        id: 17545,
        // Duration
        data: new EBMLFloat642(0)
      }, seekHead, cues = [], blobBuffer = new BlobBuffer2(options.fileWriter || options.fd);
      function fileOffsetToSegmentRelative(fileOffset) {
        return fileOffset - ebmlSegment.dataOffset;
      }
      function createSeekHead() {
        var seekPositionEBMLTemplate = {
          id: 21420,
          // SeekPosition
          size: 5,
          // Allows for 32GB video files
          data: 0
          // We'll overwrite this when the file is complete
        }, result = {
          id: 290298740,
          // SeekHead
          data: []
        };
        for (var name in seekPoints) {
          var seekPoint = seekPoints[name];
          seekPoint.positionEBML = Object.create(seekPositionEBMLTemplate);
          result.data.push({
            id: 19899,
            // Seek
            data: [
              {
                id: 21419,
                // SeekID
                data: seekPoint.id
              },
              seekPoint.positionEBML
            ]
          });
        }
        return result;
      }
      function writeHeader() {
        seekHead = createSeekHead();
        var ebmlHeader = {
          id: 440786851,
          // EBML
          data: [
            {
              id: 17030,
              // EBMLVersion
              data: 1
            },
            {
              id: 17143,
              // EBMLReadVersion
              data: 1
            },
            {
              id: 17138,
              // EBMLMaxIDLength
              data: 4
            },
            {
              id: 17139,
              // EBMLMaxSizeLength
              data: 8
            },
            {
              id: 17026,
              // DocType
              data: "webm"
            },
            {
              id: 17031,
              // DocTypeVersion
              data: 2
            },
            {
              id: 17029,
              // DocTypeReadVersion
              data: 2
            }
          ]
        }, segmentInfo = {
          id: 357149030,
          // Info
          data: [
            {
              id: 2807729,
              // TimecodeScale
              data: 1e6
              // Times will be in miliseconds (1e6 nanoseconds per step = 1ms)
            },
            {
              id: 19840,
              // MuxingApp
              data: "webm-writer-js"
            },
            {
              id: 22337,
              // WritingApp
              data: "webm-writer-js"
            },
            segmentDuration
            // To be filled in later
          ]
        }, tracks = {
          id: 374648427,
          // Tracks
          data: [
            {
              id: 174,
              // TrackEntry
              data: [
                {
                  id: 215,
                  // TrackNumber
                  data: DEFAULT_TRACK_NUMBER
                },
                {
                  id: 29637,
                  // TrackUID
                  data: DEFAULT_TRACK_NUMBER
                },
                {
                  id: 156,
                  // FlagLacing
                  data: 0
                },
                {
                  id: 2274716,
                  // Language
                  data: "und"
                },
                {
                  id: 134,
                  // CodecID
                  data: "V_VP8"
                },
                {
                  id: 2459272,
                  // CodecName
                  data: "VP8"
                },
                {
                  id: 131,
                  // TrackType
                  data: 1
                },
                {
                  id: 224,
                  // Video
                  data: [
                    {
                      id: 176,
                      // PixelWidth
                      data: videoWidth
                    },
                    {
                      id: 186,
                      // PixelHeight
                      data: videoHeight
                    }
                  ]
                }
              ]
            }
          ]
        };
        ebmlSegment = {
          id: 408125543,
          // Segment
          size: -1,
          // Unbounded size
          data: [seekHead, segmentInfo, tracks]
        };
        var bufferStream = new ArrayBufferDataStream2(256);
        writeEBML(bufferStream, blobBuffer.pos, [ebmlHeader, ebmlSegment]);
        blobBuffer.write(bufferStream.getAsDataArray());
        seekPoints.SegmentInfo.positionEBML.data = fileOffsetToSegmentRelative(
          segmentInfo.offset
        );
        seekPoints.Tracks.positionEBML.data = fileOffsetToSegmentRelative(
          tracks.offset
        );
      }
      function createKeyframeBlock(keyframe) {
        var bufferStream = new ArrayBufferDataStream2(1 + 2 + 1);
        if (!(keyframe.trackNumber > 0 && keyframe.trackNumber < 127)) {
          throw "TrackNumber must be > 0 and < 127";
        }
        bufferStream.writeEBMLVarInt(keyframe.trackNumber);
        bufferStream.writeU16BE(keyframe.timecode);
        bufferStream.writeByte(
          1 << 7
          // Keyframe
        );
        return {
          id: 163,
          // SimpleBlock
          data: [bufferStream.getAsDataArray(), keyframe.frame]
        };
      }
      function createCluster(cluster) {
        return {
          id: 524531317,
          data: [
            {
              id: 231,
              // Timecode
              data: Math.round(cluster.timecode)
            }
          ]
        };
      }
      function addCuePoint(trackIndex, clusterTime, clusterFileOffset) {
        cues.push({
          id: 187,
          // Cue
          data: [
            {
              id: 179,
              // CueTime
              data: clusterTime
            },
            {
              id: 183,
              // CueTrackPositions
              data: [
                {
                  id: 247,
                  // CueTrack
                  data: trackIndex
                },
                {
                  id: 241,
                  // CueClusterPosition
                  data: fileOffsetToSegmentRelative(clusterFileOffset)
                }
              ]
            }
          ]
        });
      }
      function writeCues() {
        var ebml = {
          id: 475249515,
          data: cues
        }, cuesBuffer = new ArrayBufferDataStream2(16 + cues.length * 32);
        writeEBML(cuesBuffer, blobBuffer.pos, ebml);
        blobBuffer.write(cuesBuffer.getAsDataArray());
        seekPoints.Cues.positionEBML.data = fileOffsetToSegmentRelative(
          ebml.offset
        );
      }
      function flushClusterFrameBuffer() {
        if (clusterFrameBuffer.length == 0) {
          return;
        }
        var rawImageSize = 0;
        for (var i = 0; i < clusterFrameBuffer.length; i++) {
          rawImageSize += clusterFrameBuffer[i].frame.length;
        }
        var buffer = new ArrayBufferDataStream2(
          rawImageSize + clusterFrameBuffer.length * 32
        ), cluster = createCluster({
          timecode: Math.round(clusterStartTime)
        });
        for (var i = 0; i < clusterFrameBuffer.length; i++) {
          cluster.data.push(createKeyframeBlock(clusterFrameBuffer[i]));
        }
        writeEBML(buffer, blobBuffer.pos, cluster);
        blobBuffer.write(buffer.getAsDataArray());
        addCuePoint(
          DEFAULT_TRACK_NUMBER,
          Math.round(clusterStartTime),
          cluster.offset
        );
        clusterFrameBuffer = [];
        clusterStartTime += clusterDuration;
        clusterDuration = 0;
      }
      function validateOptions() {
        if (!options.frameDuration) {
          if (options.frameRate) {
            options.frameDuration = 1e3 / options.frameRate;
          } else {
            throw "Missing required frameDuration or frameRate setting";
          }
        }
      }
      function addFrameToCluster(frame) {
        frame.trackNumber = DEFAULT_TRACK_NUMBER;
        frame.timecode = Math.round(clusterDuration);
        clusterFrameBuffer.push(frame);
        clusterDuration += frame.duration;
        if (clusterDuration >= MAX_CLUSTER_DURATION_MSEC) {
          flushClusterFrameBuffer();
        }
      }
      function rewriteSeekHead() {
        var seekHeadBuffer = new ArrayBufferDataStream2(seekHead.size), oldPos = blobBuffer.pos;
        writeEBML(seekHeadBuffer, seekHead.dataOffset, seekHead.data);
        blobBuffer.seek(seekHead.dataOffset);
        blobBuffer.write(seekHeadBuffer.getAsDataArray());
        blobBuffer.seek(oldPos);
      }
      function rewriteDuration() {
        var buffer = new ArrayBufferDataStream2(8), oldPos = blobBuffer.pos;
        buffer.writeDoubleBE(clusterStartTime);
        blobBuffer.seek(segmentDuration.dataOffset);
        blobBuffer.write(buffer.getAsDataArray());
        blobBuffer.seek(oldPos);
      }
      this.addFrame = function(canvas) {
        if (writtenHeader) {
          if (canvas.width != videoWidth || canvas.height != videoHeight) {
            throw "Frame size differs from previous frames";
          }
        } else {
          videoWidth = canvas.width;
          videoHeight = canvas.height;
          writeHeader();
          writtenHeader = true;
        }
        var webP = renderAsWebP(canvas, { quality: options.quality });
        if (!webP) {
          throw "Couldn't decode WebP frame, does the browser support WebP?";
        }
        addFrameToCluster({
          frame: extractKeyframeFromWebP(webP),
          duration: options.frameDuration
        });
      };
      this.complete = function() {
        flushClusterFrameBuffer();
        writeCues();
        rewriteSeekHead();
        rewriteDuration();
        return blobBuffer.complete("video/webm");
      };
      this.getWrittenSize = function() {
        return blobBuffer.length;
      };
      options = extend(optionDefaults, options || {});
      validateOptions();
    };
  };
  var Writer = WebMWriter(ArrayBufferDataStream, BlobBuffer(null));

  // src/encoders/WebMEncoder.js
  var WebMEncoder = class extends FrameEncoder {
    constructor(params) {
      super(params);
      this.extension = "webm";
      this.mimeType = "video/webm";
      this.quality = Math.min(1, Math.max(0, (params.quality ?? 90) / 100));
      this.videoWriter = null;
      this.savedBlob = null;
    }
    async start() {
      await super.start();
      this.savedBlob = null;
      await this.dispose();
    }
    async add(canvas) {
      this.videoWriter.addFrame(canvas);
      await super.add();
    }
    async save() {
      if (this.savedBlob) return this.savedBlob;
      if (!this.frames) return null;
      const blob = await this.videoWriter.complete();
      this.savedBlob = blob.type ? blob : new Blob([blob], { type: this.mimeType });
      return this.savedBlob;
    }
    async dispose() {
      this.savedBlob = null;
      this.videoWriter = new Writer({
        quality: this.quality,
        fileWriter: null,
        fd: null,
        frameRate: this.params.framerate
      });
    }
  };

  // src/third_party/mp4-muxer.mjs
  var __accessCheck2 = (obj, member, msg) => {
    if (!member.has(obj))
      throw TypeError("Cannot " + msg);
  };
  var __privateGet2 = (obj, member, getter) => {
    __accessCheck2(obj, member, "read from private field");
    return getter ? getter.call(obj) : member.get(obj);
  };
  var __privateAdd2 = (obj, member, value) => {
    if (member.has(obj))
      throw TypeError("Cannot add the same private member more than once");
    member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
  };
  var __privateSet2 = (obj, member, value, setter) => {
    __accessCheck2(obj, member, "write to private field");
    setter ? setter.call(obj, value) : member.set(obj, value);
    return value;
  };
  var __privateWrapper2 = (obj, member, setter, getter) => ({
    set _(value) {
      __privateSet2(obj, member, value, setter);
    },
    get _() {
      return __privateGet2(obj, member, getter);
    }
  });
  var __privateMethod2 = (obj, member, method) => {
    __accessCheck2(obj, member, "access private method");
    return method;
  };
  var bytes = new Uint8Array(8);
  var view = new DataView(bytes.buffer);
  var u8 = (value) => {
    return [(value % 256 + 256) % 256];
  };
  var u16 = (value) => {
    view.setUint16(0, value, false);
    return [bytes[0], bytes[1]];
  };
  var i16 = (value) => {
    view.setInt16(0, value, false);
    return [bytes[0], bytes[1]];
  };
  var u24 = (value) => {
    view.setUint32(0, value, false);
    return [bytes[1], bytes[2], bytes[3]];
  };
  var u32 = (value) => {
    view.setUint32(0, value, false);
    return [bytes[0], bytes[1], bytes[2], bytes[3]];
  };
  var i32 = (value) => {
    view.setInt32(0, value, false);
    return [bytes[0], bytes[1], bytes[2], bytes[3]];
  };
  var u64 = (value) => {
    view.setUint32(0, Math.floor(value / 2 ** 32), false);
    view.setUint32(4, value, false);
    return [bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7]];
  };
  var fixed_8_8 = (value) => {
    view.setInt16(0, 2 ** 8 * value, false);
    return [bytes[0], bytes[1]];
  };
  var fixed_16_16 = (value) => {
    view.setInt32(0, 2 ** 16 * value, false);
    return [bytes[0], bytes[1], bytes[2], bytes[3]];
  };
  var fixed_2_30 = (value) => {
    view.setInt32(0, 2 ** 30 * value, false);
    return [bytes[0], bytes[1], bytes[2], bytes[3]];
  };
  var ascii = (text, nullTerminated = false) => {
    let bytes2 = Array(text.length).fill(null).map((_, i) => text.charCodeAt(i));
    if (nullTerminated)
      bytes2.push(0);
    return bytes2;
  };
  var last = (arr) => {
    return arr && arr[arr.length - 1];
  };
  var lastPresentedSample = (samples) => {
    let result = void 0;
    for (let sample of samples) {
      if (!result || sample.presentationTimestamp > result.presentationTimestamp) {
        result = sample;
      }
    }
    return result;
  };
  var intoTimescale = (timeInSeconds, timescale, round = true) => {
    let value = timeInSeconds * timescale;
    return round ? Math.round(value) : value;
  };
  var rotationMatrix = (rotationInDegrees) => {
    let theta = rotationInDegrees * (Math.PI / 180);
    let cosTheta = Math.cos(theta);
    let sinTheta = Math.sin(theta);
    return [
      cosTheta,
      sinTheta,
      0,
      -sinTheta,
      cosTheta,
      0,
      0,
      0,
      1
    ];
  };
  var IDENTITY_MATRIX = rotationMatrix(0);
  var matrixToBytes = (matrix) => {
    return [
      fixed_16_16(matrix[0]),
      fixed_16_16(matrix[1]),
      fixed_2_30(matrix[2]),
      fixed_16_16(matrix[3]),
      fixed_16_16(matrix[4]),
      fixed_2_30(matrix[5]),
      fixed_16_16(matrix[6]),
      fixed_16_16(matrix[7]),
      fixed_2_30(matrix[8])
    ];
  };
  var deepClone = (x) => {
    if (!x)
      return x;
    if (typeof x !== "object")
      return x;
    if (Array.isArray(x))
      return x.map(deepClone);
    return Object.fromEntries(Object.entries(x).map(([key, value]) => [key, deepClone(value)]));
  };
  var isU32 = (value) => {
    return value >= 0 && value < 2 ** 32;
  };
  var box = (type, contents, children) => ({
    type,
    contents: contents && new Uint8Array(contents.flat(10)),
    children
  });
  var fullBox = (type, version, flags, contents, children) => box(
    type,
    [u8(version), u24(flags), contents ?? []],
    children
  );
  var ftyp = (details) => {
    let minorVersion = 512;
    if (details.fragmented)
      return box("ftyp", [
        ascii("iso5"),
        // Major brand
        u32(minorVersion),
        // Minor version
        // Compatible brands
        ascii("iso5"),
        ascii("iso6"),
        ascii("mp41")
      ]);
    return box("ftyp", [
      ascii("isom"),
      // Major brand
      u32(minorVersion),
      // Minor version
      // Compatible brands
      ascii("isom"),
      details.holdsAvc ? ascii("avc1") : [],
      ascii("mp41")
    ]);
  };
  var mdat = (reserveLargeSize) => ({ type: "mdat", largeSize: reserveLargeSize });
  var free = (size) => ({ type: "free", size });
  var moov = (tracks, creationTime, fragmented = false) => box("moov", null, [
    mvhd(creationTime, tracks),
    ...tracks.map((x) => trak(x, creationTime)),
    fragmented ? mvex(tracks) : null
  ]);
  var mvhd = (creationTime, tracks) => {
    let duration = intoTimescale(Math.max(
      0,
      ...tracks.filter((x) => x.samples.length > 0).map((x) => {
        const lastSample = lastPresentedSample(x.samples);
        return lastSample.presentationTimestamp + lastSample.duration;
      })
    ), GLOBAL_TIMESCALE);
    let nextTrackId = Math.max(...tracks.map((x) => x.id)) + 1;
    let needsU64 = !isU32(creationTime) || !isU32(duration);
    let u32OrU64 = needsU64 ? u64 : u32;
    return fullBox("mvhd", +needsU64, 0, [
      u32OrU64(creationTime),
      // Creation time
      u32OrU64(creationTime),
      // Modification time
      u32(GLOBAL_TIMESCALE),
      // Timescale
      u32OrU64(duration),
      // Duration
      fixed_16_16(1),
      // Preferred rate
      fixed_8_8(1),
      // Preferred volume
      Array(10).fill(0),
      // Reserved
      matrixToBytes(IDENTITY_MATRIX),
      // Matrix
      Array(24).fill(0),
      // Pre-defined
      u32(nextTrackId)
      // Next track ID
    ]);
  };
  var trak = (track, creationTime) => box("trak", null, [
    tkhd(track, creationTime),
    mdia(track, creationTime)
  ]);
  var tkhd = (track, creationTime) => {
    let lastSample = lastPresentedSample(track.samples);
    let durationInGlobalTimescale = intoTimescale(
      lastSample ? lastSample.presentationTimestamp + lastSample.duration : 0,
      GLOBAL_TIMESCALE
    );
    let needsU64 = !isU32(creationTime) || !isU32(durationInGlobalTimescale);
    let u32OrU64 = needsU64 ? u64 : u32;
    let matrix;
    if (track.info.type === "video") {
      matrix = typeof track.info.rotation === "number" ? rotationMatrix(track.info.rotation) : track.info.rotation;
    } else {
      matrix = IDENTITY_MATRIX;
    }
    return fullBox("tkhd", +needsU64, 3, [
      u32OrU64(creationTime),
      // Creation time
      u32OrU64(creationTime),
      // Modification time
      u32(track.id),
      // Track ID
      u32(0),
      // Reserved
      u32OrU64(durationInGlobalTimescale),
      // Duration
      Array(8).fill(0),
      // Reserved
      u16(0),
      // Layer
      u16(0),
      // Alternate group
      fixed_8_8(track.info.type === "audio" ? 1 : 0),
      // Volume
      u16(0),
      // Reserved
      matrixToBytes(matrix),
      // Matrix
      fixed_16_16(track.info.type === "video" ? track.info.width : 0),
      // Track width
      fixed_16_16(track.info.type === "video" ? track.info.height : 0)
      // Track height
    ]);
  };
  var mdia = (track, creationTime) => box("mdia", null, [
    mdhd(track, creationTime),
    hdlr(track.info.type === "video" ? "vide" : "soun"),
    minf(track)
  ]);
  var mdhd = (track, creationTime) => {
    let lastSample = lastPresentedSample(track.samples);
    let localDuration = intoTimescale(
      lastSample ? lastSample.presentationTimestamp + lastSample.duration : 0,
      track.timescale
    );
    let needsU64 = !isU32(creationTime) || !isU32(localDuration);
    let u32OrU64 = needsU64 ? u64 : u32;
    return fullBox("mdhd", +needsU64, 0, [
      u32OrU64(creationTime),
      // Creation time
      u32OrU64(creationTime),
      // Modification time
      u32(track.timescale),
      // Timescale
      u32OrU64(localDuration),
      // Duration
      u16(21956),
      // Language ("und", undetermined)
      u16(0)
      // Quality
    ]);
  };
  var hdlr = (componentSubtype) => fullBox("hdlr", 0, 0, [
    ascii("mhlr"),
    // Component type
    ascii(componentSubtype),
    // Component subtype
    u32(0),
    // Component manufacturer
    u32(0),
    // Component flags
    u32(0),
    // Component flags mask
    ascii("mp4-muxer-hdlr", true)
    // Component name
  ]);
  var minf = (track) => box("minf", null, [
    track.info.type === "video" ? vmhd() : smhd(),
    dinf(),
    stbl(track)
  ]);
  var vmhd = () => fullBox("vmhd", 0, 1, [
    u16(0),
    // Graphics mode
    u16(0),
    // Opcolor R
    u16(0),
    // Opcolor G
    u16(0)
    // Opcolor B
  ]);
  var smhd = () => fullBox("smhd", 0, 0, [
    u16(0),
    // Balance
    u16(0)
    // Reserved
  ]);
  var dinf = () => box("dinf", null, [
    dref()
  ]);
  var dref = () => fullBox("dref", 0, 0, [
    u32(1)
    // Entry count
  ], [
    url()
  ]);
  var url = () => fullBox("url ", 0, 1);
  var stbl = (track) => {
    const needsCtts = track.compositionTimeOffsetTable.length > 1 || track.compositionTimeOffsetTable.some((x) => x.sampleCompositionTimeOffset !== 0);
    return box("stbl", null, [
      stsd(track),
      stts(track),
      stss(track),
      stsc(track),
      stsz(track),
      stco(track),
      needsCtts ? ctts(track) : null
    ]);
  };
  var stsd = (track) => fullBox("stsd", 0, 0, [
    u32(1)
    // Entry count
  ], [
    track.info.type === "video" ? videoSampleDescription(
      VIDEO_CODEC_TO_BOX_NAME[track.info.codec],
      track
    ) : soundSampleDescription(
      AUDIO_CODEC_TO_BOX_NAME[track.info.codec],
      track
    )
  ]);
  var videoSampleDescription = (compressionType, track) => box(compressionType, [
    Array(6).fill(0),
    // Reserved
    u16(1),
    // Data reference index
    u16(0),
    // Pre-defined
    u16(0),
    // Reserved
    Array(12).fill(0),
    // Pre-defined
    u16(track.info.width),
    // Width
    u16(track.info.height),
    // Height
    u32(4718592),
    // Horizontal resolution
    u32(4718592),
    // Vertical resolution
    u32(0),
    // Reserved
    u16(1),
    // Frame count
    Array(32).fill(0),
    // Compressor name
    u16(24),
    // Depth
    i16(65535)
    // Pre-defined
  ], [
    VIDEO_CODEC_TO_CONFIGURATION_BOX[track.info.codec](track),
    track.info.decoderConfig.colorSpace ? colr(track) : null
  ]);
  var COLOR_PRIMARIES_MAP = {
    "bt709": 1,
    // ITU-R BT.709
    "bt470bg": 5,
    // ITU-R BT.470BG
    "smpte170m": 6
    // ITU-R BT.601 525 - SMPTE 170M
  };
  var TRANSFER_CHARACTERISTICS_MAP = {
    "bt709": 1,
    // ITU-R BT.709
    "smpte170m": 6,
    // SMPTE 170M
    "iec61966-2-1": 13
    // IEC 61966-2-1
  };
  var MATRIX_COEFFICIENTS_MAP = {
    "rgb": 0,
    // Identity
    "bt709": 1,
    // ITU-R BT.709
    "bt470bg": 5,
    // ITU-R BT.470BG
    "smpte170m": 6
    // SMPTE 170M
  };
  var colr = (track) => box("colr", [
    ascii("nclx"),
    // Colour type
    u16(COLOR_PRIMARIES_MAP[track.info.decoderConfig.colorSpace.primaries]),
    // Colour primaries
    u16(TRANSFER_CHARACTERISTICS_MAP[track.info.decoderConfig.colorSpace.transfer]),
    // Transfer characteristics
    u16(MATRIX_COEFFICIENTS_MAP[track.info.decoderConfig.colorSpace.matrix]),
    // Matrix coefficients
    u8((track.info.decoderConfig.colorSpace.fullRange ? 1 : 0) << 7)
    // Full range flag
  ]);
  var avcC = (track) => track.info.decoderConfig && box("avcC", [
    // For AVC, description is an AVCDecoderConfigurationRecord, so nothing else to do here
    ...new Uint8Array(track.info.decoderConfig.description)
  ]);
  var hvcC = (track) => track.info.decoderConfig && box("hvcC", [
    // For HEVC, description is a HEVCDecoderConfigurationRecord, so nothing else to do here
    ...new Uint8Array(track.info.decoderConfig.description)
  ]);
  var vpcC = (track) => {
    if (!track.info.decoderConfig) {
      return null;
    }
    let decoderConfig = track.info.decoderConfig;
    if (!decoderConfig.colorSpace) {
      throw new Error(`'colorSpace' is required in the decoder config for VP9.`);
    }
    let parts = decoderConfig.codec.split(".");
    let profile = Number(parts[1]);
    let level = Number(parts[2]);
    let bitDepth = Number(parts[3]);
    let chromaSubsampling = 0;
    let thirdByte = (bitDepth << 4) + (chromaSubsampling << 1) + Number(decoderConfig.colorSpace.fullRange);
    let colourPrimaries = 2;
    let transferCharacteristics = 2;
    let matrixCoefficients = 2;
    return fullBox("vpcC", 1, 0, [
      u8(profile),
      // Profile
      u8(level),
      // Level
      u8(thirdByte),
      // Bit depth, chroma subsampling, full range
      u8(colourPrimaries),
      // Colour primaries
      u8(transferCharacteristics),
      // Transfer characteristics
      u8(matrixCoefficients),
      // Matrix coefficients
      u16(0)
      // Codec initialization data size
    ]);
  };
  var av1C = () => {
    let marker = 1;
    let version = 1;
    let firstByte = (marker << 7) + version;
    return box("av1C", [
      firstByte,
      0,
      0,
      0
    ]);
  };
  var soundSampleDescription = (compressionType, track) => box(compressionType, [
    Array(6).fill(0),
    // Reserved
    u16(1),
    // Data reference index
    u16(0),
    // Version
    u16(0),
    // Revision level
    u32(0),
    // Vendor
    u16(track.info.numberOfChannels),
    // Number of channels
    u16(16),
    // Sample size (bits)
    u16(0),
    // Compression ID
    u16(0),
    // Packet size
    fixed_16_16(track.info.sampleRate)
    // Sample rate
  ], [
    AUDIO_CODEC_TO_CONFIGURATION_BOX[track.info.codec](track)
  ]);
  var esds = (track) => {
    let description = new Uint8Array(track.info.decoderConfig.description);
    return fullBox("esds", 0, 0, [
      // https://stackoverflow.com/a/54803118
      u32(58753152),
      // TAG(3) = Object Descriptor ([2])
      u8(32 + description.byteLength),
      // length of this OD (which includes the next 2 tags)
      u16(1),
      // ES_ID = 1
      u8(0),
      // flags etc = 0
      u32(75530368),
      // TAG(4) = ES Descriptor ([2]) embedded in above OD
      u8(18 + description.byteLength),
      // length of this ESD
      u8(64),
      // MPEG-4 Audio
      u8(21),
      // stream type(6bits)=5 audio, flags(2bits)=1
      u24(0),
      // 24bit buffer size
      u32(130071),
      // max bitrate
      u32(130071),
      // avg bitrate
      u32(92307584),
      // TAG(5) = ASC ([2],[3]) embedded in above OD
      u8(description.byteLength),
      // length
      ...description,
      u32(109084800),
      // TAG(6)
      u8(1),
      // length
      u8(2)
      // data
    ]);
  };
  var dOps = (track) => {
    let preskip = 3840;
    let gain = 0;
    const description = track.info.decoderConfig?.description;
    if (description) {
      if (description.byteLength < 18) {
        throw new TypeError("Invalid decoder description provided for Opus; must be at least 18 bytes long.");
      }
      const view2 = ArrayBuffer.isView(description) ? new DataView(description.buffer, description.byteOffset, description.byteLength) : new DataView(description);
      preskip = view2.getUint16(10, true);
      gain = view2.getInt16(14, true);
    }
    return box("dOps", [
      u8(0),
      // Version
      u8(track.info.numberOfChannels),
      // OutputChannelCount
      u16(preskip),
      u32(track.info.sampleRate),
      // InputSampleRate
      fixed_8_8(gain),
      // OutputGain
      u8(0)
      // ChannelMappingFamily
    ]);
  };
  var stts = (track) => {
    return fullBox("stts", 0, 0, [
      u32(track.timeToSampleTable.length),
      // Number of entries
      track.timeToSampleTable.map((x) => [
        // Time-to-sample table
        u32(x.sampleCount),
        // Sample count
        u32(x.sampleDelta)
        // Sample duration
      ])
    ]);
  };
  var stss = (track) => {
    if (track.samples.every((x) => x.type === "key"))
      return null;
    let keySamples = [...track.samples.entries()].filter(([, sample]) => sample.type === "key");
    return fullBox("stss", 0, 0, [
      u32(keySamples.length),
      // Number of entries
      keySamples.map(([index]) => u32(index + 1))
      // Sync sample table
    ]);
  };
  var stsc = (track) => {
    return fullBox("stsc", 0, 0, [
      u32(track.compactlyCodedChunkTable.length),
      // Number of entries
      track.compactlyCodedChunkTable.map((x) => [
        // Sample-to-chunk table
        u32(x.firstChunk),
        // First chunk
        u32(x.samplesPerChunk),
        // Samples per chunk
        u32(1)
        // Sample description index
      ])
    ]);
  };
  var stsz = (track) => fullBox("stsz", 0, 0, [
    u32(0),
    // Sample size (0 means non-constant size)
    u32(track.samples.length),
    // Number of entries
    track.samples.map((x) => u32(x.size))
    // Sample size table
  ]);
  var stco = (track) => {
    if (track.finalizedChunks.length > 0 && last(track.finalizedChunks).offset >= 2 ** 32) {
      return fullBox("co64", 0, 0, [
        u32(track.finalizedChunks.length),
        // Number of entries
        track.finalizedChunks.map((x) => u64(x.offset))
        // Chunk offset table
      ]);
    }
    return fullBox("stco", 0, 0, [
      u32(track.finalizedChunks.length),
      // Number of entries
      track.finalizedChunks.map((x) => u32(x.offset))
      // Chunk offset table
    ]);
  };
  var ctts = (track) => {
    return fullBox("ctts", 0, 0, [
      u32(track.compositionTimeOffsetTable.length),
      // Number of entries
      track.compositionTimeOffsetTable.map((x) => [
        // Time-to-sample table
        u32(x.sampleCount),
        // Sample count
        u32(x.sampleCompositionTimeOffset)
        // Sample offset
      ])
    ]);
  };
  var mvex = (tracks) => {
    return box("mvex", null, tracks.map(trex));
  };
  var trex = (track) => {
    return fullBox("trex", 0, 0, [
      u32(track.id),
      // Track ID
      u32(1),
      // Default sample description index
      u32(0),
      // Default sample duration
      u32(0),
      // Default sample size
      u32(0)
      // Default sample flags
    ]);
  };
  var moof = (sequenceNumber, tracks) => {
    return box("moof", null, [
      mfhd(sequenceNumber),
      ...tracks.map(traf)
    ]);
  };
  var mfhd = (sequenceNumber) => {
    return fullBox("mfhd", 0, 0, [
      u32(sequenceNumber)
      // Sequence number
    ]);
  };
  var fragmentSampleFlags = (sample) => {
    let byte1 = 0;
    let byte2 = 0;
    let byte3 = 0;
    let byte4 = 0;
    let sampleIsDifferenceSample = sample.type === "delta";
    byte2 |= +sampleIsDifferenceSample;
    if (sampleIsDifferenceSample) {
      byte1 |= 1;
    } else {
      byte1 |= 2;
    }
    return byte1 << 24 | byte2 << 16 | byte3 << 8 | byte4;
  };
  var traf = (track) => {
    return box("traf", null, [
      tfhd(track),
      tfdt(track),
      trun(track)
    ]);
  };
  var tfhd = (track) => {
    let tfFlags = 0;
    tfFlags |= 8;
    tfFlags |= 16;
    tfFlags |= 32;
    tfFlags |= 131072;
    let referenceSample = track.currentChunk.samples[1] ?? track.currentChunk.samples[0];
    let referenceSampleInfo = {
      duration: referenceSample.timescaleUnitsToNextSample,
      size: referenceSample.size,
      flags: fragmentSampleFlags(referenceSample)
    };
    return fullBox("tfhd", 0, tfFlags, [
      u32(track.id),
      // Track ID
      u32(referenceSampleInfo.duration),
      // Default sample duration
      u32(referenceSampleInfo.size),
      // Default sample size
      u32(referenceSampleInfo.flags)
      // Default sample flags
    ]);
  };
  var tfdt = (track) => {
    return fullBox("tfdt", 1, 0, [
      u64(intoTimescale(track.currentChunk.startTimestamp, track.timescale))
      // Base Media Decode Time
    ]);
  };
  var trun = (track) => {
    let allSampleDurations = track.currentChunk.samples.map((x) => x.timescaleUnitsToNextSample);
    let allSampleSizes = track.currentChunk.samples.map((x) => x.size);
    let allSampleFlags = track.currentChunk.samples.map(fragmentSampleFlags);
    let allSampleCompositionTimeOffsets = track.currentChunk.samples.map((x) => intoTimescale(x.presentationTimestamp - x.decodeTimestamp, track.timescale));
    let uniqueSampleDurations = new Set(allSampleDurations);
    let uniqueSampleSizes = new Set(allSampleSizes);
    let uniqueSampleFlags = new Set(allSampleFlags);
    let uniqueSampleCompositionTimeOffsets = new Set(allSampleCompositionTimeOffsets);
    let firstSampleFlagsPresent = uniqueSampleFlags.size === 2 && allSampleFlags[0] !== allSampleFlags[1];
    let sampleDurationPresent = uniqueSampleDurations.size > 1;
    let sampleSizePresent = uniqueSampleSizes.size > 1;
    let sampleFlagsPresent = !firstSampleFlagsPresent && uniqueSampleFlags.size > 1;
    let sampleCompositionTimeOffsetsPresent = uniqueSampleCompositionTimeOffsets.size > 1 || [...uniqueSampleCompositionTimeOffsets].some((x) => x !== 0);
    let flags = 0;
    flags |= 1;
    flags |= 4 * +firstSampleFlagsPresent;
    flags |= 256 * +sampleDurationPresent;
    flags |= 512 * +sampleSizePresent;
    flags |= 1024 * +sampleFlagsPresent;
    flags |= 2048 * +sampleCompositionTimeOffsetsPresent;
    return fullBox("trun", 1, flags, [
      u32(track.currentChunk.samples.length),
      // Sample count
      u32(track.currentChunk.offset - track.currentChunk.moofOffset || 0),
      // Data offset
      firstSampleFlagsPresent ? u32(allSampleFlags[0]) : [],
      track.currentChunk.samples.map((_, i) => [
        sampleDurationPresent ? u32(allSampleDurations[i]) : [],
        // Sample duration
        sampleSizePresent ? u32(allSampleSizes[i]) : [],
        // Sample size
        sampleFlagsPresent ? u32(allSampleFlags[i]) : [],
        // Sample flags
        // Sample composition time offsets
        sampleCompositionTimeOffsetsPresent ? i32(allSampleCompositionTimeOffsets[i]) : []
      ])
    ]);
  };
  var mfra = (tracks) => {
    return box("mfra", null, [
      ...tracks.map(tfra),
      mfro()
    ]);
  };
  var tfra = (track, trackIndex) => {
    let version = 1;
    return fullBox("tfra", version, 0, [
      u32(track.id),
      // Track ID
      u32(63),
      // This specifies that traf number, trun number and sample number are 32-bit ints
      u32(track.finalizedChunks.length),
      // Number of entries
      track.finalizedChunks.map((chunk) => [
        u64(intoTimescale(chunk.startTimestamp, track.timescale)),
        // Time
        u64(chunk.moofOffset),
        // moof offset
        u32(trackIndex + 1),
        // traf number
        u32(1),
        // trun number
        u32(1)
        // Sample number
      ])
    ]);
  };
  var mfro = () => {
    return fullBox("mfro", 0, 0, [
      // This value needs to be overwritten manually from the outside, where the actual size of the enclosing mfra box
      // is known
      u32(0)
      // Size
    ]);
  };
  var VIDEO_CODEC_TO_BOX_NAME = {
    "avc": "avc1",
    "hevc": "hvc1",
    "vp9": "vp09",
    "av1": "av01"
  };
  var VIDEO_CODEC_TO_CONFIGURATION_BOX = {
    "avc": avcC,
    "hevc": hvcC,
    "vp9": vpcC,
    "av1": av1C
  };
  var AUDIO_CODEC_TO_BOX_NAME = {
    "aac": "mp4a",
    "opus": "Opus"
  };
  var AUDIO_CODEC_TO_CONFIGURATION_BOX = {
    "aac": esds,
    "opus": dOps
  };
  var isTarget = Symbol("isTarget");
  var Target = class {
  };
  var ArrayBufferTarget = class extends Target {
    constructor() {
      super(...arguments);
      this.buffer = null;
    }
  };
  var StreamTarget = class extends Target {
    constructor(options) {
      super();
      this.options = options;
      if (typeof options !== "object") {
        throw new TypeError("StreamTarget requires an options object to be passed to its constructor.");
      }
      if (options.onData) {
        if (typeof options.onData !== "function") {
          throw new TypeError("options.onData, when provided, must be a function.");
        }
        if (options.onData.length < 2) {
          throw new TypeError(
            "options.onData, when provided, must be a function that takes in at least two arguments (data and position). Ignoring the position argument, which specifies the byte offset at which the data is to be written, can lead to broken outputs."
          );
        }
      }
      if (options.chunked !== void 0 && typeof options.chunked !== "boolean") {
        throw new TypeError("options.chunked, when provided, must be a boolean.");
      }
      if (options.chunkSize !== void 0 && (!Number.isInteger(options.chunkSize) || options.chunkSize < 1024)) {
        throw new TypeError("options.chunkSize, when provided, must be an integer and not smaller than 1024.");
      }
    }
  };
  var FileSystemWritableFileStreamTarget = class extends Target {
    constructor(stream, options) {
      super();
      this.stream = stream;
      this.options = options;
      if (!(stream instanceof FileSystemWritableFileStream)) {
        throw new TypeError("FileSystemWritableFileStreamTarget requires a FileSystemWritableFileStream instance.");
      }
      if (options !== void 0 && typeof options !== "object") {
        throw new TypeError("FileSystemWritableFileStreamTarget's options, when provided, must be an object.");
      }
      if (options) {
        if (options.chunkSize !== void 0 && (!Number.isInteger(options.chunkSize) || options.chunkSize <= 0)) {
          throw new TypeError("options.chunkSize, when provided, must be a positive integer");
        }
      }
    }
  };
  var _helper;
  var _helperView;
  var Writer2 = class {
    constructor() {
      this.pos = 0;
      __privateAdd2(this, _helper, new Uint8Array(8));
      __privateAdd2(this, _helperView, new DataView(__privateGet2(this, _helper).buffer));
      this.offsets = /* @__PURE__ */ new WeakMap();
    }
    /** Sets the current position for future writes to a new one. */
    seek(newPos) {
      this.pos = newPos;
    }
    writeU32(value) {
      __privateGet2(this, _helperView).setUint32(0, value, false);
      this.write(__privateGet2(this, _helper).subarray(0, 4));
    }
    writeU64(value) {
      __privateGet2(this, _helperView).setUint32(0, Math.floor(value / 2 ** 32), false);
      __privateGet2(this, _helperView).setUint32(4, value, false);
      this.write(__privateGet2(this, _helper).subarray(0, 8));
    }
    writeAscii(text) {
      for (let i = 0; i < text.length; i++) {
        __privateGet2(this, _helperView).setUint8(i % 8, text.charCodeAt(i));
        if (i % 8 === 7)
          this.write(__privateGet2(this, _helper));
      }
      if (text.length % 8 !== 0) {
        this.write(__privateGet2(this, _helper).subarray(0, text.length % 8));
      }
    }
    writeBox(box2) {
      this.offsets.set(box2, this.pos);
      if (box2.contents && !box2.children) {
        this.writeBoxHeader(box2, box2.size ?? box2.contents.byteLength + 8);
        this.write(box2.contents);
      } else {
        let startPos = this.pos;
        this.writeBoxHeader(box2, 0);
        if (box2.contents)
          this.write(box2.contents);
        if (box2.children) {
          for (let child of box2.children)
            if (child)
              this.writeBox(child);
        }
        let endPos = this.pos;
        let size = box2.size ?? endPos - startPos;
        this.seek(startPos);
        this.writeBoxHeader(box2, size);
        this.seek(endPos);
      }
    }
    writeBoxHeader(box2, size) {
      this.writeU32(box2.largeSize ? 1 : size);
      this.writeAscii(box2.type);
      if (box2.largeSize)
        this.writeU64(size);
    }
    measureBoxHeader(box2) {
      return 8 + (box2.largeSize ? 8 : 0);
    }
    patchBox(box2) {
      let endPos = this.pos;
      this.seek(this.offsets.get(box2));
      this.writeBox(box2);
      this.seek(endPos);
    }
    measureBox(box2) {
      if (box2.contents && !box2.children) {
        let headerSize = this.measureBoxHeader(box2);
        return headerSize + box2.contents.byteLength;
      } else {
        let result = this.measureBoxHeader(box2);
        if (box2.contents)
          result += box2.contents.byteLength;
        if (box2.children) {
          for (let child of box2.children)
            if (child)
              result += this.measureBox(child);
        }
        return result;
      }
    }
  };
  _helper = /* @__PURE__ */ new WeakMap();
  _helperView = /* @__PURE__ */ new WeakMap();
  var _target;
  var _buffer;
  var _bytes;
  var _maxPos;
  var _ensureSize;
  var ensureSize_fn3;
  var ArrayBufferTargetWriter = class extends Writer2 {
    constructor(target2) {
      super();
      __privateAdd2(this, _ensureSize);
      __privateAdd2(this, _target, void 0);
      __privateAdd2(this, _buffer, new ArrayBuffer(2 ** 16));
      __privateAdd2(this, _bytes, new Uint8Array(__privateGet2(this, _buffer)));
      __privateAdd2(this, _maxPos, 0);
      __privateSet2(this, _target, target2);
    }
    write(data) {
      __privateMethod2(this, _ensureSize, ensureSize_fn3).call(this, this.pos + data.byteLength);
      __privateGet2(this, _bytes).set(data, this.pos);
      this.pos += data.byteLength;
      __privateSet2(this, _maxPos, Math.max(__privateGet2(this, _maxPos), this.pos));
    }
    finalize() {
      __privateMethod2(this, _ensureSize, ensureSize_fn3).call(this, this.pos);
      __privateGet2(this, _target).buffer = __privateGet2(this, _buffer).slice(0, Math.max(__privateGet2(this, _maxPos), this.pos));
    }
  };
  _target = /* @__PURE__ */ new WeakMap();
  _buffer = /* @__PURE__ */ new WeakMap();
  _bytes = /* @__PURE__ */ new WeakMap();
  _maxPos = /* @__PURE__ */ new WeakMap();
  _ensureSize = /* @__PURE__ */ new WeakSet();
  ensureSize_fn3 = function(size) {
    let newLength = __privateGet2(this, _buffer).byteLength;
    while (newLength < size)
      newLength *= 2;
    if (newLength === __privateGet2(this, _buffer).byteLength)
      return;
    let newBuffer = new ArrayBuffer(newLength);
    let newBytes = new Uint8Array(newBuffer);
    newBytes.set(__privateGet2(this, _bytes), 0);
    __privateSet2(this, _buffer, newBuffer);
    __privateSet2(this, _bytes, newBytes);
  };
  var DEFAULT_CHUNK_SIZE = 2 ** 24;
  var MAX_CHUNKS_AT_ONCE = 2;
  var _target2;
  var _sections;
  var _chunked;
  var _chunkSize;
  var _chunks;
  var _writeDataIntoChunks;
  var writeDataIntoChunks_fn;
  var _insertSectionIntoChunk;
  var insertSectionIntoChunk_fn;
  var _createChunk;
  var createChunk_fn;
  var _flushChunks;
  var flushChunks_fn;
  var StreamTargetWriter = class extends Writer2 {
    constructor(target2) {
      super();
      __privateAdd2(this, _writeDataIntoChunks);
      __privateAdd2(this, _insertSectionIntoChunk);
      __privateAdd2(this, _createChunk);
      __privateAdd2(this, _flushChunks);
      __privateAdd2(this, _target2, void 0);
      __privateAdd2(this, _sections, []);
      __privateAdd2(this, _chunked, void 0);
      __privateAdd2(this, _chunkSize, void 0);
      __privateAdd2(this, _chunks, []);
      __privateSet2(this, _target2, target2);
      __privateSet2(this, _chunked, target2.options?.chunked ?? false);
      __privateSet2(this, _chunkSize, target2.options?.chunkSize ?? DEFAULT_CHUNK_SIZE);
    }
    write(data) {
      __privateGet2(this, _sections).push({
        data: data.slice(),
        start: this.pos
      });
      this.pos += data.byteLength;
    }
    flush() {
      if (__privateGet2(this, _sections).length === 0)
        return;
      let chunks = [];
      let sorted = [...__privateGet2(this, _sections)].sort((a, b) => a.start - b.start);
      chunks.push({
        start: sorted[0].start,
        size: sorted[0].data.byteLength
      });
      for (let i = 1; i < sorted.length; i++) {
        let lastChunk = chunks[chunks.length - 1];
        let section = sorted[i];
        if (section.start <= lastChunk.start + lastChunk.size) {
          lastChunk.size = Math.max(lastChunk.size, section.start + section.data.byteLength - lastChunk.start);
        } else {
          chunks.push({
            start: section.start,
            size: section.data.byteLength
          });
        }
      }
      for (let chunk of chunks) {
        chunk.data = new Uint8Array(chunk.size);
        for (let section of __privateGet2(this, _sections)) {
          if (chunk.start <= section.start && section.start < chunk.start + chunk.size) {
            chunk.data.set(section.data, section.start - chunk.start);
          }
        }
        if (__privateGet2(this, _chunked)) {
          __privateMethod2(this, _writeDataIntoChunks, writeDataIntoChunks_fn).call(this, chunk.data, chunk.start);
          __privateMethod2(this, _flushChunks, flushChunks_fn).call(this);
        } else {
          __privateGet2(this, _target2).options.onData?.(chunk.data, chunk.start);
        }
      }
      __privateGet2(this, _sections).length = 0;
    }
    finalize() {
      if (__privateGet2(this, _chunked)) {
        __privateMethod2(this, _flushChunks, flushChunks_fn).call(this, true);
      }
    }
  };
  _target2 = /* @__PURE__ */ new WeakMap();
  _sections = /* @__PURE__ */ new WeakMap();
  _chunked = /* @__PURE__ */ new WeakMap();
  _chunkSize = /* @__PURE__ */ new WeakMap();
  _chunks = /* @__PURE__ */ new WeakMap();
  _writeDataIntoChunks = /* @__PURE__ */ new WeakSet();
  writeDataIntoChunks_fn = function(data, position) {
    let chunkIndex = __privateGet2(this, _chunks).findIndex((x) => x.start <= position && position < x.start + __privateGet2(this, _chunkSize));
    if (chunkIndex === -1)
      chunkIndex = __privateMethod2(this, _createChunk, createChunk_fn).call(this, position);
    let chunk = __privateGet2(this, _chunks)[chunkIndex];
    let relativePosition = position - chunk.start;
    let toWrite = data.subarray(0, Math.min(__privateGet2(this, _chunkSize) - relativePosition, data.byteLength));
    chunk.data.set(toWrite, relativePosition);
    let section = {
      start: relativePosition,
      end: relativePosition + toWrite.byteLength
    };
    __privateMethod2(this, _insertSectionIntoChunk, insertSectionIntoChunk_fn).call(this, chunk, section);
    if (chunk.written[0].start === 0 && chunk.written[0].end === __privateGet2(this, _chunkSize)) {
      chunk.shouldFlush = true;
    }
    if (__privateGet2(this, _chunks).length > MAX_CHUNKS_AT_ONCE) {
      for (let i = 0; i < __privateGet2(this, _chunks).length - 1; i++) {
        __privateGet2(this, _chunks)[i].shouldFlush = true;
      }
      __privateMethod2(this, _flushChunks, flushChunks_fn).call(this);
    }
    if (toWrite.byteLength < data.byteLength) {
      __privateMethod2(this, _writeDataIntoChunks, writeDataIntoChunks_fn).call(this, data.subarray(toWrite.byteLength), position + toWrite.byteLength);
    }
  };
  _insertSectionIntoChunk = /* @__PURE__ */ new WeakSet();
  insertSectionIntoChunk_fn = function(chunk, section) {
    let low = 0;
    let high = chunk.written.length - 1;
    let index = -1;
    while (low <= high) {
      let mid = Math.floor(low + (high - low + 1) / 2);
      if (chunk.written[mid].start <= section.start) {
        low = mid + 1;
        index = mid;
      } else {
        high = mid - 1;
      }
    }
    chunk.written.splice(index + 1, 0, section);
    if (index === -1 || chunk.written[index].end < section.start)
      index++;
    while (index < chunk.written.length - 1 && chunk.written[index].end >= chunk.written[index + 1].start) {
      chunk.written[index].end = Math.max(chunk.written[index].end, chunk.written[index + 1].end);
      chunk.written.splice(index + 1, 1);
    }
  };
  _createChunk = /* @__PURE__ */ new WeakSet();
  createChunk_fn = function(includesPosition) {
    let start = Math.floor(includesPosition / __privateGet2(this, _chunkSize)) * __privateGet2(this, _chunkSize);
    let chunk = {
      start,
      data: new Uint8Array(__privateGet2(this, _chunkSize)),
      written: [],
      shouldFlush: false
    };
    __privateGet2(this, _chunks).push(chunk);
    __privateGet2(this, _chunks).sort((a, b) => a.start - b.start);
    return __privateGet2(this, _chunks).indexOf(chunk);
  };
  _flushChunks = /* @__PURE__ */ new WeakSet();
  flushChunks_fn = function(force = false) {
    for (let i = 0; i < __privateGet2(this, _chunks).length; i++) {
      let chunk = __privateGet2(this, _chunks)[i];
      if (!chunk.shouldFlush && !force)
        continue;
      for (let section of chunk.written) {
        __privateGet2(this, _target2).options.onData?.(
          chunk.data.subarray(section.start, section.end),
          chunk.start + section.start
        );
      }
      __privateGet2(this, _chunks).splice(i--, 1);
    }
  };
  var FileSystemWritableFileStreamTargetWriter = class extends StreamTargetWriter {
    constructor(target2) {
      super(new StreamTarget({
        onData: (data, position) => target2.stream.write({
          type: "write",
          data,
          position
        }),
        chunked: true,
        chunkSize: target2.options?.chunkSize
      }));
    }
  };
  var GLOBAL_TIMESCALE = 1e3;
  var SUPPORTED_VIDEO_CODECS = ["avc", "hevc", "vp9", "av1"];
  var SUPPORTED_AUDIO_CODECS = ["aac", "opus"];
  var TIMESTAMP_OFFSET = 2082844800;
  var FIRST_TIMESTAMP_BEHAVIORS = ["strict", "offset", "cross-track-offset"];
  var _options;
  var _writer;
  var _ftypSize;
  var _mdat;
  var _videoTrack;
  var _audioTrack;
  var _creationTime;
  var _finalizedChunks;
  var _nextFragmentNumber;
  var _videoSampleQueue;
  var _audioSampleQueue;
  var _finalized;
  var _validateOptions;
  var validateOptions_fn;
  var _writeHeader;
  var writeHeader_fn;
  var _computeMoovSizeUpperBound;
  var computeMoovSizeUpperBound_fn;
  var _prepareTracks;
  var prepareTracks_fn;
  var _generateMpeg4AudioSpecificConfig;
  var generateMpeg4AudioSpecificConfig_fn;
  var _createSampleForTrack;
  var createSampleForTrack_fn;
  var _addSampleToTrack;
  var addSampleToTrack_fn;
  var _validateTimestamp;
  var validateTimestamp_fn;
  var _finalizeCurrentChunk;
  var finalizeCurrentChunk_fn;
  var _finalizeFragment;
  var finalizeFragment_fn;
  var _maybeFlushStreamingTargetWriter;
  var maybeFlushStreamingTargetWriter_fn;
  var _ensureNotFinalized;
  var ensureNotFinalized_fn;
  var Muxer = class {
    constructor(options) {
      __privateAdd2(this, _validateOptions);
      __privateAdd2(this, _writeHeader);
      __privateAdd2(this, _computeMoovSizeUpperBound);
      __privateAdd2(this, _prepareTracks);
      __privateAdd2(this, _generateMpeg4AudioSpecificConfig);
      __privateAdd2(this, _createSampleForTrack);
      __privateAdd2(this, _addSampleToTrack);
      __privateAdd2(this, _validateTimestamp);
      __privateAdd2(this, _finalizeCurrentChunk);
      __privateAdd2(this, _finalizeFragment);
      __privateAdd2(this, _maybeFlushStreamingTargetWriter);
      __privateAdd2(this, _ensureNotFinalized);
      __privateAdd2(this, _options, void 0);
      __privateAdd2(this, _writer, void 0);
      __privateAdd2(this, _ftypSize, void 0);
      __privateAdd2(this, _mdat, void 0);
      __privateAdd2(this, _videoTrack, null);
      __privateAdd2(this, _audioTrack, null);
      __privateAdd2(this, _creationTime, Math.floor(Date.now() / 1e3) + TIMESTAMP_OFFSET);
      __privateAdd2(this, _finalizedChunks, []);
      __privateAdd2(this, _nextFragmentNumber, 1);
      __privateAdd2(this, _videoSampleQueue, []);
      __privateAdd2(this, _audioSampleQueue, []);
      __privateAdd2(this, _finalized, false);
      __privateMethod2(this, _validateOptions, validateOptions_fn).call(this, options);
      options.video = deepClone(options.video);
      options.audio = deepClone(options.audio);
      options.fastStart = deepClone(options.fastStart);
      this.target = options.target;
      __privateSet2(this, _options, {
        firstTimestampBehavior: "strict",
        ...options
      });
      if (options.target instanceof ArrayBufferTarget) {
        __privateSet2(this, _writer, new ArrayBufferTargetWriter(options.target));
      } else if (options.target instanceof StreamTarget) {
        __privateSet2(this, _writer, new StreamTargetWriter(options.target));
      } else if (options.target instanceof FileSystemWritableFileStreamTarget) {
        __privateSet2(this, _writer, new FileSystemWritableFileStreamTargetWriter(options.target));
      } else {
        throw new Error(`Invalid target: ${options.target}`);
      }
      __privateMethod2(this, _prepareTracks, prepareTracks_fn).call(this);
      __privateMethod2(this, _writeHeader, writeHeader_fn).call(this);
    }
    addVideoChunk(sample, meta, timestamp, compositionTimeOffset) {
      if (!(sample instanceof EncodedVideoChunk)) {
        throw new TypeError("addVideoChunk's first argument (sample) must be of type EncodedVideoChunk.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addVideoChunk's second argument (meta), when provided, must be an object.");
      }
      if (timestamp !== void 0 && (!Number.isFinite(timestamp) || timestamp < 0)) {
        throw new TypeError(
          "addVideoChunk's third argument (timestamp), when provided, must be a non-negative real number."
        );
      }
      if (compositionTimeOffset !== void 0 && !Number.isFinite(compositionTimeOffset)) {
        throw new TypeError(
          "addVideoChunk's fourth argument (compositionTimeOffset), when provided, must be a real number."
        );
      }
      let data = new Uint8Array(sample.byteLength);
      sample.copyTo(data);
      this.addVideoChunkRaw(
        data,
        sample.type,
        timestamp ?? sample.timestamp,
        sample.duration,
        meta,
        compositionTimeOffset
      );
    }
    addVideoChunkRaw(data, type, timestamp, duration, meta, compositionTimeOffset) {
      if (!(data instanceof Uint8Array)) {
        throw new TypeError("addVideoChunkRaw's first argument (data) must be an instance of Uint8Array.");
      }
      if (type !== "key" && type !== "delta") {
        throw new TypeError("addVideoChunkRaw's second argument (type) must be either 'key' or 'delta'.");
      }
      if (!Number.isFinite(timestamp) || timestamp < 0) {
        throw new TypeError("addVideoChunkRaw's third argument (timestamp) must be a non-negative real number.");
      }
      if (!Number.isFinite(duration) || duration < 0) {
        throw new TypeError("addVideoChunkRaw's fourth argument (duration) must be a non-negative real number.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addVideoChunkRaw's fifth argument (meta), when provided, must be an object.");
      }
      if (compositionTimeOffset !== void 0 && !Number.isFinite(compositionTimeOffset)) {
        throw new TypeError(
          "addVideoChunkRaw's sixth argument (compositionTimeOffset), when provided, must be a real number."
        );
      }
      __privateMethod2(this, _ensureNotFinalized, ensureNotFinalized_fn).call(this);
      if (!__privateGet2(this, _options).video)
        throw new Error("No video track declared.");
      if (typeof __privateGet2(this, _options).fastStart === "object" && __privateGet2(this, _videoTrack).samples.length === __privateGet2(this, _options).fastStart.expectedVideoChunks) {
        throw new Error(`Cannot add more video chunks than specified in 'fastStart' (${__privateGet2(this, _options).fastStart.expectedVideoChunks}).`);
      }
      let videoSample = __privateMethod2(this, _createSampleForTrack, createSampleForTrack_fn).call(this, __privateGet2(this, _videoTrack), data, type, timestamp, duration, meta, compositionTimeOffset);
      if (__privateGet2(this, _options).fastStart === "fragmented" && __privateGet2(this, _audioTrack)) {
        while (__privateGet2(this, _audioSampleQueue).length > 0 && __privateGet2(this, _audioSampleQueue)[0].decodeTimestamp <= videoSample.decodeTimestamp) {
          let audioSample = __privateGet2(this, _audioSampleQueue).shift();
          __privateMethod2(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet2(this, _audioTrack), audioSample);
        }
        if (videoSample.decodeTimestamp <= __privateGet2(this, _audioTrack).lastDecodeTimestamp) {
          __privateMethod2(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet2(this, _videoTrack), videoSample);
        } else {
          __privateGet2(this, _videoSampleQueue).push(videoSample);
        }
      } else {
        __privateMethod2(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet2(this, _videoTrack), videoSample);
      }
    }
    addAudioChunk(sample, meta, timestamp) {
      if (!(sample instanceof EncodedAudioChunk)) {
        throw new TypeError("addAudioChunk's first argument (sample) must be of type EncodedAudioChunk.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addAudioChunk's second argument (meta), when provided, must be an object.");
      }
      if (timestamp !== void 0 && (!Number.isFinite(timestamp) || timestamp < 0)) {
        throw new TypeError(
          "addAudioChunk's third argument (timestamp), when provided, must be a non-negative real number."
        );
      }
      let data = new Uint8Array(sample.byteLength);
      sample.copyTo(data);
      this.addAudioChunkRaw(data, sample.type, timestamp ?? sample.timestamp, sample.duration, meta);
    }
    addAudioChunkRaw(data, type, timestamp, duration, meta) {
      if (!(data instanceof Uint8Array)) {
        throw new TypeError("addAudioChunkRaw's first argument (data) must be an instance of Uint8Array.");
      }
      if (type !== "key" && type !== "delta") {
        throw new TypeError("addAudioChunkRaw's second argument (type) must be either 'key' or 'delta'.");
      }
      if (!Number.isFinite(timestamp) || timestamp < 0) {
        throw new TypeError("addAudioChunkRaw's third argument (timestamp) must be a non-negative real number.");
      }
      if (!Number.isFinite(duration) || duration < 0) {
        throw new TypeError("addAudioChunkRaw's fourth argument (duration) must be a non-negative real number.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addAudioChunkRaw's fifth argument (meta), when provided, must be an object.");
      }
      __privateMethod2(this, _ensureNotFinalized, ensureNotFinalized_fn).call(this);
      if (!__privateGet2(this, _options).audio)
        throw new Error("No audio track declared.");
      if (typeof __privateGet2(this, _options).fastStart === "object" && __privateGet2(this, _audioTrack).samples.length === __privateGet2(this, _options).fastStart.expectedAudioChunks) {
        throw new Error(`Cannot add more audio chunks than specified in 'fastStart' (${__privateGet2(this, _options).fastStart.expectedAudioChunks}).`);
      }
      let audioSample = __privateMethod2(this, _createSampleForTrack, createSampleForTrack_fn).call(this, __privateGet2(this, _audioTrack), data, type, timestamp, duration, meta);
      if (__privateGet2(this, _options).fastStart === "fragmented" && __privateGet2(this, _videoTrack)) {
        while (__privateGet2(this, _videoSampleQueue).length > 0 && __privateGet2(this, _videoSampleQueue)[0].decodeTimestamp <= audioSample.decodeTimestamp) {
          let videoSample = __privateGet2(this, _videoSampleQueue).shift();
          __privateMethod2(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet2(this, _videoTrack), videoSample);
        }
        if (audioSample.decodeTimestamp <= __privateGet2(this, _videoTrack).lastDecodeTimestamp) {
          __privateMethod2(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet2(this, _audioTrack), audioSample);
        } else {
          __privateGet2(this, _audioSampleQueue).push(audioSample);
        }
      } else {
        __privateMethod2(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet2(this, _audioTrack), audioSample);
      }
    }
    /** Finalizes the file, making it ready for use. Must be called after all video and audio chunks have been added. */
    finalize() {
      if (__privateGet2(this, _finalized)) {
        throw new Error("Cannot finalize a muxer more than once.");
      }
      if (__privateGet2(this, _options).fastStart === "fragmented") {
        for (let videoSample of __privateGet2(this, _videoSampleQueue))
          __privateMethod2(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet2(this, _videoTrack), videoSample);
        for (let audioSample of __privateGet2(this, _audioSampleQueue))
          __privateMethod2(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet2(this, _audioTrack), audioSample);
        __privateMethod2(this, _finalizeFragment, finalizeFragment_fn).call(this, false);
      } else {
        if (__privateGet2(this, _videoTrack))
          __privateMethod2(this, _finalizeCurrentChunk, finalizeCurrentChunk_fn).call(this, __privateGet2(this, _videoTrack));
        if (__privateGet2(this, _audioTrack))
          __privateMethod2(this, _finalizeCurrentChunk, finalizeCurrentChunk_fn).call(this, __privateGet2(this, _audioTrack));
      }
      let tracks = [__privateGet2(this, _videoTrack), __privateGet2(this, _audioTrack)].filter(Boolean);
      if (__privateGet2(this, _options).fastStart === "in-memory") {
        let mdatSize;
        for (let i = 0; i < 2; i++) {
          let movieBox2 = moov(tracks, __privateGet2(this, _creationTime));
          let movieBoxSize = __privateGet2(this, _writer).measureBox(movieBox2);
          mdatSize = __privateGet2(this, _writer).measureBox(__privateGet2(this, _mdat));
          let currentChunkPos = __privateGet2(this, _writer).pos + movieBoxSize + mdatSize;
          for (let chunk of __privateGet2(this, _finalizedChunks)) {
            chunk.offset = currentChunkPos;
            for (let { data } of chunk.samples) {
              currentChunkPos += data.byteLength;
              mdatSize += data.byteLength;
            }
          }
          if (currentChunkPos < 2 ** 32)
            break;
          if (mdatSize >= 2 ** 32)
            __privateGet2(this, _mdat).largeSize = true;
        }
        let movieBox = moov(tracks, __privateGet2(this, _creationTime));
        __privateGet2(this, _writer).writeBox(movieBox);
        __privateGet2(this, _mdat).size = mdatSize;
        __privateGet2(this, _writer).writeBox(__privateGet2(this, _mdat));
        for (let chunk of __privateGet2(this, _finalizedChunks)) {
          for (let sample of chunk.samples) {
            __privateGet2(this, _writer).write(sample.data);
            sample.data = null;
          }
        }
      } else if (__privateGet2(this, _options).fastStart === "fragmented") {
        let startPos = __privateGet2(this, _writer).pos;
        let mfraBox = mfra(tracks);
        __privateGet2(this, _writer).writeBox(mfraBox);
        let mfraBoxSize = __privateGet2(this, _writer).pos - startPos;
        __privateGet2(this, _writer).seek(__privateGet2(this, _writer).pos - 4);
        __privateGet2(this, _writer).writeU32(mfraBoxSize);
      } else {
        let mdatPos = __privateGet2(this, _writer).offsets.get(__privateGet2(this, _mdat));
        let mdatSize = __privateGet2(this, _writer).pos - mdatPos;
        __privateGet2(this, _mdat).size = mdatSize;
        __privateGet2(this, _mdat).largeSize = mdatSize >= 2 ** 32;
        __privateGet2(this, _writer).patchBox(__privateGet2(this, _mdat));
        let movieBox = moov(tracks, __privateGet2(this, _creationTime));
        if (typeof __privateGet2(this, _options).fastStart === "object") {
          __privateGet2(this, _writer).seek(__privateGet2(this, _ftypSize));
          __privateGet2(this, _writer).writeBox(movieBox);
          let remainingBytes = mdatPos - __privateGet2(this, _writer).pos;
          __privateGet2(this, _writer).writeBox(free(remainingBytes));
        } else {
          __privateGet2(this, _writer).writeBox(movieBox);
        }
      }
      __privateMethod2(this, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn).call(this);
      __privateGet2(this, _writer).finalize();
      __privateSet2(this, _finalized, true);
    }
  };
  _options = /* @__PURE__ */ new WeakMap();
  _writer = /* @__PURE__ */ new WeakMap();
  _ftypSize = /* @__PURE__ */ new WeakMap();
  _mdat = /* @__PURE__ */ new WeakMap();
  _videoTrack = /* @__PURE__ */ new WeakMap();
  _audioTrack = /* @__PURE__ */ new WeakMap();
  _creationTime = /* @__PURE__ */ new WeakMap();
  _finalizedChunks = /* @__PURE__ */ new WeakMap();
  _nextFragmentNumber = /* @__PURE__ */ new WeakMap();
  _videoSampleQueue = /* @__PURE__ */ new WeakMap();
  _audioSampleQueue = /* @__PURE__ */ new WeakMap();
  _finalized = /* @__PURE__ */ new WeakMap();
  _validateOptions = /* @__PURE__ */ new WeakSet();
  validateOptions_fn = function(options) {
    if (typeof options !== "object") {
      throw new TypeError("The muxer requires an options object to be passed to its constructor.");
    }
    if (!(options.target instanceof Target)) {
      throw new TypeError("The target must be provided and an instance of Target.");
    }
    if (options.video) {
      if (!SUPPORTED_VIDEO_CODECS.includes(options.video.codec)) {
        throw new TypeError(`Unsupported video codec: ${options.video.codec}`);
      }
      if (!Number.isInteger(options.video.width) || options.video.width <= 0) {
        throw new TypeError(`Invalid video width: ${options.video.width}. Must be a positive integer.`);
      }
      if (!Number.isInteger(options.video.height) || options.video.height <= 0) {
        throw new TypeError(`Invalid video height: ${options.video.height}. Must be a positive integer.`);
      }
      const videoRotation = options.video.rotation;
      if (typeof videoRotation === "number" && ![0, 90, 180, 270].includes(videoRotation)) {
        throw new TypeError(`Invalid video rotation: ${videoRotation}. Has to be 0, 90, 180 or 270.`);
      } else if (Array.isArray(videoRotation) && (videoRotation.length !== 9 || videoRotation.some((value) => typeof value !== "number"))) {
        throw new TypeError(`Invalid video transformation matrix: ${videoRotation.join()}`);
      }
      if (options.video.frameRate !== void 0 && (!Number.isInteger(options.video.frameRate) || options.video.frameRate <= 0)) {
        throw new TypeError(
          `Invalid video frame rate: ${options.video.frameRate}. Must be a positive integer.`
        );
      }
    }
    if (options.audio) {
      if (!SUPPORTED_AUDIO_CODECS.includes(options.audio.codec)) {
        throw new TypeError(`Unsupported audio codec: ${options.audio.codec}`);
      }
      if (!Number.isInteger(options.audio.numberOfChannels) || options.audio.numberOfChannels <= 0) {
        throw new TypeError(
          `Invalid number of audio channels: ${options.audio.numberOfChannels}. Must be a positive integer.`
        );
      }
      if (!Number.isInteger(options.audio.sampleRate) || options.audio.sampleRate <= 0) {
        throw new TypeError(
          `Invalid audio sample rate: ${options.audio.sampleRate}. Must be a positive integer.`
        );
      }
    }
    if (options.firstTimestampBehavior && !FIRST_TIMESTAMP_BEHAVIORS.includes(options.firstTimestampBehavior)) {
      throw new TypeError(`Invalid first timestamp behavior: ${options.firstTimestampBehavior}`);
    }
    if (typeof options.fastStart === "object") {
      if (options.video) {
        if (options.fastStart.expectedVideoChunks === void 0) {
          throw new TypeError(`'fastStart' is an object but is missing property 'expectedVideoChunks'.`);
        } else if (!Number.isInteger(options.fastStart.expectedVideoChunks) || options.fastStart.expectedVideoChunks < 0) {
          throw new TypeError(`'expectedVideoChunks' must be a non-negative integer.`);
        }
      }
      if (options.audio) {
        if (options.fastStart.expectedAudioChunks === void 0) {
          throw new TypeError(`'fastStart' is an object but is missing property 'expectedAudioChunks'.`);
        } else if (!Number.isInteger(options.fastStart.expectedAudioChunks) || options.fastStart.expectedAudioChunks < 0) {
          throw new TypeError(`'expectedAudioChunks' must be a non-negative integer.`);
        }
      }
    } else if (![false, "in-memory", "fragmented"].includes(options.fastStart)) {
      throw new TypeError(`'fastStart' option must be false, 'in-memory', 'fragmented' or an object.`);
    }
    if (options.minFragmentDuration !== void 0 && (!Number.isFinite(options.minFragmentDuration) || options.minFragmentDuration < 0)) {
      throw new TypeError(`'minFragmentDuration' must be a non-negative number.`);
    }
  };
  _writeHeader = /* @__PURE__ */ new WeakSet();
  writeHeader_fn = function() {
    __privateGet2(this, _writer).writeBox(ftyp({
      holdsAvc: __privateGet2(this, _options).video?.codec === "avc",
      fragmented: __privateGet2(this, _options).fastStart === "fragmented"
    }));
    __privateSet2(this, _ftypSize, __privateGet2(this, _writer).pos);
    if (__privateGet2(this, _options).fastStart === "in-memory") {
      __privateSet2(this, _mdat, mdat(false));
    } else if (__privateGet2(this, _options).fastStart === "fragmented") {
    } else {
      if (typeof __privateGet2(this, _options).fastStart === "object") {
        let moovSizeUpperBound = __privateMethod2(this, _computeMoovSizeUpperBound, computeMoovSizeUpperBound_fn).call(this);
        __privateGet2(this, _writer).seek(__privateGet2(this, _writer).pos + moovSizeUpperBound);
      }
      __privateSet2(this, _mdat, mdat(true));
      __privateGet2(this, _writer).writeBox(__privateGet2(this, _mdat));
    }
    __privateMethod2(this, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn).call(this);
  };
  _computeMoovSizeUpperBound = /* @__PURE__ */ new WeakSet();
  computeMoovSizeUpperBound_fn = function() {
    if (typeof __privateGet2(this, _options).fastStart !== "object")
      return;
    let upperBound = 0;
    let sampleCounts = [
      __privateGet2(this, _options).fastStart.expectedVideoChunks,
      __privateGet2(this, _options).fastStart.expectedAudioChunks
    ];
    for (let n of sampleCounts) {
      if (!n)
        continue;
      upperBound += (4 + 4) * Math.ceil(2 / 3 * n);
      upperBound += 4 * n;
      upperBound += (4 + 4 + 4) * Math.ceil(2 / 3 * n);
      upperBound += 4 * n;
      upperBound += 8 * n;
    }
    upperBound += 4096;
    return upperBound;
  };
  _prepareTracks = /* @__PURE__ */ new WeakSet();
  prepareTracks_fn = function() {
    if (__privateGet2(this, _options).video) {
      __privateSet2(this, _videoTrack, {
        id: 1,
        info: {
          type: "video",
          codec: __privateGet2(this, _options).video.codec,
          width: __privateGet2(this, _options).video.width,
          height: __privateGet2(this, _options).video.height,
          rotation: __privateGet2(this, _options).video.rotation ?? 0,
          decoderConfig: null
        },
        // The fallback contains many common frame rates as factors
        timescale: __privateGet2(this, _options).video.frameRate ?? 57600,
        samples: [],
        finalizedChunks: [],
        currentChunk: null,
        firstDecodeTimestamp: void 0,
        lastDecodeTimestamp: -1,
        timeToSampleTable: [],
        compositionTimeOffsetTable: [],
        lastTimescaleUnits: null,
        lastSample: null,
        compactlyCodedChunkTable: []
      });
    }
    if (__privateGet2(this, _options).audio) {
      __privateSet2(this, _audioTrack, {
        id: __privateGet2(this, _options).video ? 2 : 1,
        info: {
          type: "audio",
          codec: __privateGet2(this, _options).audio.codec,
          numberOfChannels: __privateGet2(this, _options).audio.numberOfChannels,
          sampleRate: __privateGet2(this, _options).audio.sampleRate,
          decoderConfig: null
        },
        timescale: __privateGet2(this, _options).audio.sampleRate,
        samples: [],
        finalizedChunks: [],
        currentChunk: null,
        firstDecodeTimestamp: void 0,
        lastDecodeTimestamp: -1,
        timeToSampleTable: [],
        compositionTimeOffsetTable: [],
        lastTimescaleUnits: null,
        lastSample: null,
        compactlyCodedChunkTable: []
      });
      if (__privateGet2(this, _options).audio.codec === "aac") {
        let guessedCodecPrivate = __privateMethod2(this, _generateMpeg4AudioSpecificConfig, generateMpeg4AudioSpecificConfig_fn).call(
          this,
          2,
          // Object type for AAC-LC, since it's the most common
          __privateGet2(this, _options).audio.sampleRate,
          __privateGet2(this, _options).audio.numberOfChannels
        );
        __privateGet2(this, _audioTrack).info.decoderConfig = {
          codec: __privateGet2(this, _options).audio.codec,
          description: guessedCodecPrivate,
          numberOfChannels: __privateGet2(this, _options).audio.numberOfChannels,
          sampleRate: __privateGet2(this, _options).audio.sampleRate
        };
      }
    }
  };
  _generateMpeg4AudioSpecificConfig = /* @__PURE__ */ new WeakSet();
  generateMpeg4AudioSpecificConfig_fn = function(objectType, sampleRate, numberOfChannels) {
    let frequencyIndices = [96e3, 88200, 64e3, 48e3, 44100, 32e3, 24e3, 22050, 16e3, 12e3, 11025, 8e3, 7350];
    let frequencyIndex = frequencyIndices.indexOf(sampleRate);
    let channelConfig = numberOfChannels;
    let configBits = "";
    configBits += objectType.toString(2).padStart(5, "0");
    configBits += frequencyIndex.toString(2).padStart(4, "0");
    if (frequencyIndex === 15)
      configBits += sampleRate.toString(2).padStart(24, "0");
    configBits += channelConfig.toString(2).padStart(4, "0");
    let paddingLength = Math.ceil(configBits.length / 8) * 8;
    configBits = configBits.padEnd(paddingLength, "0");
    let configBytes = new Uint8Array(configBits.length / 8);
    for (let i = 0; i < configBits.length; i += 8) {
      configBytes[i / 8] = parseInt(configBits.slice(i, i + 8), 2);
    }
    return configBytes;
  };
  _createSampleForTrack = /* @__PURE__ */ new WeakSet();
  createSampleForTrack_fn = function(track, data, type, timestamp, duration, meta, compositionTimeOffset) {
    let presentationTimestampInSeconds = timestamp / 1e6;
    let decodeTimestampInSeconds = (timestamp - (compositionTimeOffset ?? 0)) / 1e6;
    let durationInSeconds = duration / 1e6;
    let adjusted = __privateMethod2(this, _validateTimestamp, validateTimestamp_fn).call(this, presentationTimestampInSeconds, decodeTimestampInSeconds, track);
    presentationTimestampInSeconds = adjusted.presentationTimestamp;
    decodeTimestampInSeconds = adjusted.decodeTimestamp;
    if (meta?.decoderConfig) {
      if (track.info.decoderConfig === null) {
        track.info.decoderConfig = meta.decoderConfig;
      } else {
        Object.assign(track.info.decoderConfig, meta.decoderConfig);
      }
    }
    let sample = {
      presentationTimestamp: presentationTimestampInSeconds,
      decodeTimestamp: decodeTimestampInSeconds,
      duration: durationInSeconds,
      data,
      size: data.byteLength,
      type,
      // Will be refined once the next sample comes in
      timescaleUnitsToNextSample: intoTimescale(durationInSeconds, track.timescale)
    };
    return sample;
  };
  _addSampleToTrack = /* @__PURE__ */ new WeakSet();
  addSampleToTrack_fn = function(track, sample) {
    if (__privateGet2(this, _options).fastStart !== "fragmented") {
      track.samples.push(sample);
    }
    const sampleCompositionTimeOffset = intoTimescale(sample.presentationTimestamp - sample.decodeTimestamp, track.timescale);
    if (track.lastTimescaleUnits !== null) {
      let timescaleUnits = intoTimescale(sample.decodeTimestamp, track.timescale, false);
      let delta = Math.round(timescaleUnits - track.lastTimescaleUnits);
      track.lastTimescaleUnits += delta;
      track.lastSample.timescaleUnitsToNextSample = delta;
      if (__privateGet2(this, _options).fastStart !== "fragmented") {
        let lastTableEntry = last(track.timeToSampleTable);
        if (lastTableEntry.sampleCount === 1) {
          lastTableEntry.sampleDelta = delta;
          lastTableEntry.sampleCount++;
        } else if (lastTableEntry.sampleDelta === delta) {
          lastTableEntry.sampleCount++;
        } else {
          lastTableEntry.sampleCount--;
          track.timeToSampleTable.push({
            sampleCount: 2,
            sampleDelta: delta
          });
        }
        const lastCompositionTimeOffsetTableEntry = last(track.compositionTimeOffsetTable);
        if (lastCompositionTimeOffsetTableEntry.sampleCompositionTimeOffset === sampleCompositionTimeOffset) {
          lastCompositionTimeOffsetTableEntry.sampleCount++;
        } else {
          track.compositionTimeOffsetTable.push({
            sampleCount: 1,
            sampleCompositionTimeOffset
          });
        }
      }
    } else {
      track.lastTimescaleUnits = 0;
      if (__privateGet2(this, _options).fastStart !== "fragmented") {
        track.timeToSampleTable.push({
          sampleCount: 1,
          sampleDelta: intoTimescale(sample.duration, track.timescale)
        });
        track.compositionTimeOffsetTable.push({
          sampleCount: 1,
          sampleCompositionTimeOffset
        });
      }
    }
    track.lastSample = sample;
    let beginNewChunk = false;
    if (!track.currentChunk) {
      beginNewChunk = true;
    } else {
      let currentChunkDuration = sample.presentationTimestamp - track.currentChunk.startTimestamp;
      if (__privateGet2(this, _options).fastStart === "fragmented") {
        let mostImportantTrack = __privateGet2(this, _videoTrack) ?? __privateGet2(this, _audioTrack);
        const chunkDuration = __privateGet2(this, _options).minFragmentDuration ?? 1;
        if (track === mostImportantTrack && sample.type === "key" && currentChunkDuration >= chunkDuration) {
          beginNewChunk = true;
          __privateMethod2(this, _finalizeFragment, finalizeFragment_fn).call(this);
        }
      } else {
        beginNewChunk = currentChunkDuration >= 0.5;
      }
    }
    if (beginNewChunk) {
      if (track.currentChunk) {
        __privateMethod2(this, _finalizeCurrentChunk, finalizeCurrentChunk_fn).call(this, track);
      }
      track.currentChunk = {
        startTimestamp: sample.presentationTimestamp,
        samples: []
      };
    }
    track.currentChunk.samples.push(sample);
  };
  _validateTimestamp = /* @__PURE__ */ new WeakSet();
  validateTimestamp_fn = function(presentationTimestamp, decodeTimestamp, track) {
    const strictTimestampBehavior = __privateGet2(this, _options).firstTimestampBehavior === "strict";
    const noLastDecodeTimestamp = track.lastDecodeTimestamp === -1;
    const timestampNonZero = decodeTimestamp !== 0;
    if (strictTimestampBehavior && noLastDecodeTimestamp && timestampNonZero) {
      throw new Error(
        `The first chunk for your media track must have a timestamp of 0 (received DTS=${decodeTimestamp}).Non-zero first timestamps are often caused by directly piping frames or audio data from a MediaStreamTrack into the encoder. Their timestamps are typically relative to the age of thedocument, which is probably what you want.

If you want to offset all timestamps of a track such that the first one is zero, set firstTimestampBehavior: 'offset' in the options.
`
      );
    } else if (__privateGet2(this, _options).firstTimestampBehavior === "offset" || __privateGet2(this, _options).firstTimestampBehavior === "cross-track-offset") {
      if (track.firstDecodeTimestamp === void 0) {
        track.firstDecodeTimestamp = decodeTimestamp;
      }
      let baseDecodeTimestamp;
      if (__privateGet2(this, _options).firstTimestampBehavior === "offset") {
        baseDecodeTimestamp = track.firstDecodeTimestamp;
      } else {
        baseDecodeTimestamp = Math.min(
          __privateGet2(this, _videoTrack)?.firstDecodeTimestamp ?? Infinity,
          __privateGet2(this, _audioTrack)?.firstDecodeTimestamp ?? Infinity
        );
      }
      decodeTimestamp -= baseDecodeTimestamp;
      presentationTimestamp -= baseDecodeTimestamp;
    }
    if (decodeTimestamp < track.lastDecodeTimestamp) {
      throw new Error(
        `Timestamps must be monotonically increasing (DTS went from ${track.lastDecodeTimestamp * 1e6} to ${decodeTimestamp * 1e6}).`
      );
    }
    track.lastDecodeTimestamp = decodeTimestamp;
    return { presentationTimestamp, decodeTimestamp };
  };
  _finalizeCurrentChunk = /* @__PURE__ */ new WeakSet();
  finalizeCurrentChunk_fn = function(track) {
    if (__privateGet2(this, _options).fastStart === "fragmented") {
      throw new Error("Can't finalize individual chunks if 'fastStart' is set to 'fragmented'.");
    }
    if (!track.currentChunk)
      return;
    track.finalizedChunks.push(track.currentChunk);
    __privateGet2(this, _finalizedChunks).push(track.currentChunk);
    if (track.compactlyCodedChunkTable.length === 0 || last(track.compactlyCodedChunkTable).samplesPerChunk !== track.currentChunk.samples.length) {
      track.compactlyCodedChunkTable.push({
        firstChunk: track.finalizedChunks.length,
        // 1-indexed
        samplesPerChunk: track.currentChunk.samples.length
      });
    }
    if (__privateGet2(this, _options).fastStart === "in-memory") {
      track.currentChunk.offset = 0;
      return;
    }
    track.currentChunk.offset = __privateGet2(this, _writer).pos;
    for (let sample of track.currentChunk.samples) {
      __privateGet2(this, _writer).write(sample.data);
      sample.data = null;
    }
    __privateMethod2(this, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn).call(this);
  };
  _finalizeFragment = /* @__PURE__ */ new WeakSet();
  finalizeFragment_fn = function(flushStreamingWriter = true) {
    if (__privateGet2(this, _options).fastStart !== "fragmented") {
      throw new Error("Can't finalize a fragment unless 'fastStart' is set to 'fragmented'.");
    }
    let tracks = [__privateGet2(this, _videoTrack), __privateGet2(this, _audioTrack)].filter((track) => track && track.currentChunk);
    if (tracks.length === 0)
      return;
    let fragmentNumber = __privateWrapper2(this, _nextFragmentNumber)._++;
    if (fragmentNumber === 1) {
      let movieBox = moov(tracks, __privateGet2(this, _creationTime), true);
      __privateGet2(this, _writer).writeBox(movieBox);
    }
    let moofOffset = __privateGet2(this, _writer).pos;
    let moofBox = moof(fragmentNumber, tracks);
    __privateGet2(this, _writer).writeBox(moofBox);
    {
      let mdatBox = mdat(false);
      let totalTrackSampleSize = 0;
      for (let track of tracks) {
        for (let sample of track.currentChunk.samples) {
          totalTrackSampleSize += sample.size;
        }
      }
      let mdatSize = __privateGet2(this, _writer).measureBox(mdatBox) + totalTrackSampleSize;
      if (mdatSize >= 2 ** 32) {
        mdatBox.largeSize = true;
        mdatSize = __privateGet2(this, _writer).measureBox(mdatBox) + totalTrackSampleSize;
      }
      mdatBox.size = mdatSize;
      __privateGet2(this, _writer).writeBox(mdatBox);
    }
    for (let track of tracks) {
      track.currentChunk.offset = __privateGet2(this, _writer).pos;
      track.currentChunk.moofOffset = moofOffset;
      for (let sample of track.currentChunk.samples) {
        __privateGet2(this, _writer).write(sample.data);
        sample.data = null;
      }
    }
    let endPos = __privateGet2(this, _writer).pos;
    __privateGet2(this, _writer).seek(__privateGet2(this, _writer).offsets.get(moofBox));
    let newMoofBox = moof(fragmentNumber, tracks);
    __privateGet2(this, _writer).writeBox(newMoofBox);
    __privateGet2(this, _writer).seek(endPos);
    for (let track of tracks) {
      track.finalizedChunks.push(track.currentChunk);
      __privateGet2(this, _finalizedChunks).push(track.currentChunk);
      track.currentChunk = null;
    }
    if (flushStreamingWriter) {
      __privateMethod2(this, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn).call(this);
    }
  };
  _maybeFlushStreamingTargetWriter = /* @__PURE__ */ new WeakSet();
  maybeFlushStreamingTargetWriter_fn = function() {
    if (__privateGet2(this, _writer) instanceof StreamTargetWriter) {
      __privateGet2(this, _writer).flush();
    }
  };
  _ensureNotFinalized = /* @__PURE__ */ new WeakSet();
  ensureNotFinalized_fn = function() {
    if (__privateGet2(this, _finalized)) {
      throw new Error("Cannot add new video or audio chunks after the file has been finalized.");
    }
  };

  // src/third_party/webm-muxer.mjs
  var __accessCheck3 = (obj, member, msg) => {
    if (!member.has(obj))
      throw TypeError("Cannot " + msg);
  };
  var __privateGet3 = (obj, member, getter) => {
    __accessCheck3(obj, member, "read from private field");
    return getter ? getter.call(obj) : member.get(obj);
  };
  var __privateAdd3 = (obj, member, value) => {
    if (member.has(obj))
      throw TypeError("Cannot add the same private member more than once");
    member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
  };
  var __privateSet3 = (obj, member, value, setter) => {
    __accessCheck3(obj, member, "write to private field");
    setter ? setter.call(obj, value) : member.set(obj, value);
    return value;
  };
  var __privateMethod3 = (obj, member, method) => {
    __accessCheck3(obj, member, "access private method");
    return method;
  };
  var EBMLFloat32 = class {
    constructor(value) {
      this.value = value;
    }
  };
  var EBMLFloat64 = class {
    constructor(value) {
      this.value = value;
    }
  };
  var measureUnsignedInt = (value) => {
    if (value < 1 << 8) {
      return 1;
    } else if (value < 1 << 16) {
      return 2;
    } else if (value < 1 << 24) {
      return 3;
    } else if (value < 2 ** 32) {
      return 4;
    } else if (value < 2 ** 40) {
      return 5;
    } else {
      return 6;
    }
  };
  var measureEBMLVarInt = (value) => {
    if (value < (1 << 7) - 1) {
      return 1;
    } else if (value < (1 << 14) - 1) {
      return 2;
    } else if (value < (1 << 21) - 1) {
      return 3;
    } else if (value < (1 << 28) - 1) {
      return 4;
    } else if (value < 2 ** 35 - 1) {
      return 5;
    } else if (value < 2 ** 42 - 1) {
      return 6;
    } else {
      throw new Error("EBML VINT size not supported " + value);
    }
  };
  var readBits = (bytes2, start, end) => {
    let result = 0;
    for (let i = start; i < end; i++) {
      let byteIndex = Math.floor(i / 8);
      let byte = bytes2[byteIndex];
      let bitIndex = 7 - (i & 7);
      let bit = (byte & 1 << bitIndex) >> bitIndex;
      result <<= 1;
      result |= bit;
    }
    return result;
  };
  var writeBits = (bytes2, start, end, value) => {
    for (let i = start; i < end; i++) {
      let byteIndex = Math.floor(i / 8);
      let byte = bytes2[byteIndex];
      let bitIndex = 7 - (i & 7);
      byte &= ~(1 << bitIndex);
      byte |= (value & 1 << end - i - 1) >> end - i - 1 << bitIndex;
      bytes2[byteIndex] = byte;
    }
  };
  var isTarget2 = Symbol("isTarget");
  var Target2 = class {
  };
  var ArrayBufferTarget2 = class extends Target2 {
    constructor() {
      super(...arguments);
      this.buffer = null;
    }
  };
  var StreamTarget2 = class extends Target2 {
    constructor(options) {
      super();
      this.options = options;
      if (typeof options !== "object") {
        throw new TypeError("StreamTarget requires an options object to be passed to its constructor.");
      }
      if (options.onData) {
        if (typeof options.onData !== "function") {
          throw new TypeError("options.onData, when provided, must be a function.");
        }
        if (options.onData.length < 2) {
          throw new TypeError(
            "options.onData, when provided, must be a function that takes in at least two arguments (data and position). Ignoring the position argument, which specifies the byte offset at which the data is to be written, can lead to broken outputs."
          );
        }
      }
      if (options.onHeader && typeof options.onHeader !== "function") {
        throw new TypeError("options.onHeader, when provided, must be a function.");
      }
      if (options.onCluster && typeof options.onCluster !== "function") {
        throw new TypeError("options.onCluster, when provided, must be a function.");
      }
      if (options.chunked !== void 0 && typeof options.chunked !== "boolean") {
        throw new TypeError("options.chunked, when provided, must be a boolean.");
      }
      if (options.chunkSize !== void 0 && (!Number.isInteger(options.chunkSize) || options.chunkSize <= 0)) {
        throw new TypeError("options.chunkSize, when provided, must be a positive integer.");
      }
    }
  };
  var FileSystemWritableFileStreamTarget2 = class extends Target2 {
    constructor(stream, options) {
      super();
      this.stream = stream;
      this.options = options;
      if (!(stream instanceof FileSystemWritableFileStream)) {
        throw new TypeError("FileSystemWritableFileStreamTarget requires a FileSystemWritableFileStream instance.");
      }
      if (options !== void 0 && typeof options !== "object") {
        throw new TypeError("FileSystemWritableFileStreamTarget's options, when provided, must be an object.");
      }
      if (options) {
        if (options.chunkSize !== void 0 && (!Number.isInteger(options.chunkSize) || options.chunkSize <= 0)) {
          throw new TypeError("options.chunkSize, when provided, must be a positive integer");
        }
      }
    }
  };
  var _helper2;
  var _helperView2;
  var _writeByte;
  var writeByte_fn;
  var _writeFloat32;
  var writeFloat32_fn;
  var _writeFloat64;
  var writeFloat64_fn;
  var _writeUnsignedInt;
  var writeUnsignedInt_fn;
  var _writeString;
  var writeString_fn;
  var Writer3 = class {
    constructor() {
      __privateAdd3(this, _writeByte);
      __privateAdd3(this, _writeFloat32);
      __privateAdd3(this, _writeFloat64);
      __privateAdd3(this, _writeUnsignedInt);
      __privateAdd3(this, _writeString);
      this.pos = 0;
      __privateAdd3(this, _helper2, new Uint8Array(8));
      __privateAdd3(this, _helperView2, new DataView(__privateGet3(this, _helper2).buffer));
      this.offsets = /* @__PURE__ */ new WeakMap();
      this.dataOffsets = /* @__PURE__ */ new WeakMap();
    }
    seek(newPos) {
      this.pos = newPos;
    }
    writeEBMLVarInt(value, width = measureEBMLVarInt(value)) {
      let pos = 0;
      switch (width) {
        case 1:
          __privateGet3(this, _helperView2).setUint8(pos++, 1 << 7 | value);
          break;
        case 2:
          __privateGet3(this, _helperView2).setUint8(pos++, 1 << 6 | value >> 8);
          __privateGet3(this, _helperView2).setUint8(pos++, value);
          break;
        case 3:
          __privateGet3(this, _helperView2).setUint8(pos++, 1 << 5 | value >> 16);
          __privateGet3(this, _helperView2).setUint8(pos++, value >> 8);
          __privateGet3(this, _helperView2).setUint8(pos++, value);
          break;
        case 4:
          __privateGet3(this, _helperView2).setUint8(pos++, 1 << 4 | value >> 24);
          __privateGet3(this, _helperView2).setUint8(pos++, value >> 16);
          __privateGet3(this, _helperView2).setUint8(pos++, value >> 8);
          __privateGet3(this, _helperView2).setUint8(pos++, value);
          break;
        case 5:
          __privateGet3(this, _helperView2).setUint8(pos++, 1 << 3 | value / 2 ** 32 & 7);
          __privateGet3(this, _helperView2).setUint8(pos++, value >> 24);
          __privateGet3(this, _helperView2).setUint8(pos++, value >> 16);
          __privateGet3(this, _helperView2).setUint8(pos++, value >> 8);
          __privateGet3(this, _helperView2).setUint8(pos++, value);
          break;
        case 6:
          __privateGet3(this, _helperView2).setUint8(pos++, 1 << 2 | value / 2 ** 40 & 3);
          __privateGet3(this, _helperView2).setUint8(pos++, value / 2 ** 32 | 0);
          __privateGet3(this, _helperView2).setUint8(pos++, value >> 24);
          __privateGet3(this, _helperView2).setUint8(pos++, value >> 16);
          __privateGet3(this, _helperView2).setUint8(pos++, value >> 8);
          __privateGet3(this, _helperView2).setUint8(pos++, value);
          break;
        default:
          throw new Error("Bad EBML VINT size " + width);
      }
      this.write(__privateGet3(this, _helper2).subarray(0, pos));
    }
    writeEBML(data) {
      if (data === null)
        return;
      if (data instanceof Uint8Array) {
        this.write(data);
      } else if (Array.isArray(data)) {
        for (let elem of data) {
          this.writeEBML(elem);
        }
      } else {
        this.offsets.set(data, this.pos);
        __privateMethod3(this, _writeUnsignedInt, writeUnsignedInt_fn).call(this, data.id);
        if (Array.isArray(data.data)) {
          let sizePos = this.pos;
          let sizeSize = data.size === -1 ? 1 : data.size ?? 4;
          if (data.size === -1) {
            __privateMethod3(this, _writeByte, writeByte_fn).call(this, 255);
          } else {
            this.seek(this.pos + sizeSize);
          }
          let startPos = this.pos;
          this.dataOffsets.set(data, startPos);
          this.writeEBML(data.data);
          if (data.size !== -1) {
            let size = this.pos - startPos;
            let endPos = this.pos;
            this.seek(sizePos);
            this.writeEBMLVarInt(size, sizeSize);
            this.seek(endPos);
          }
        } else if (typeof data.data === "number") {
          let size = data.size ?? measureUnsignedInt(data.data);
          this.writeEBMLVarInt(size);
          __privateMethod3(this, _writeUnsignedInt, writeUnsignedInt_fn).call(this, data.data, size);
        } else if (typeof data.data === "string") {
          this.writeEBMLVarInt(data.data.length);
          __privateMethod3(this, _writeString, writeString_fn).call(this, data.data);
        } else if (data.data instanceof Uint8Array) {
          this.writeEBMLVarInt(data.data.byteLength, data.size);
          this.write(data.data);
        } else if (data.data instanceof EBMLFloat32) {
          this.writeEBMLVarInt(4);
          __privateMethod3(this, _writeFloat32, writeFloat32_fn).call(this, data.data.value);
        } else if (data.data instanceof EBMLFloat64) {
          this.writeEBMLVarInt(8);
          __privateMethod3(this, _writeFloat64, writeFloat64_fn).call(this, data.data.value);
        }
      }
    }
  };
  _helper2 = /* @__PURE__ */ new WeakMap();
  _helperView2 = /* @__PURE__ */ new WeakMap();
  _writeByte = /* @__PURE__ */ new WeakSet();
  writeByte_fn = function(value) {
    __privateGet3(this, _helperView2).setUint8(0, value);
    this.write(__privateGet3(this, _helper2).subarray(0, 1));
  };
  _writeFloat32 = /* @__PURE__ */ new WeakSet();
  writeFloat32_fn = function(value) {
    __privateGet3(this, _helperView2).setFloat32(0, value, false);
    this.write(__privateGet3(this, _helper2).subarray(0, 4));
  };
  _writeFloat64 = /* @__PURE__ */ new WeakSet();
  writeFloat64_fn = function(value) {
    __privateGet3(this, _helperView2).setFloat64(0, value, false);
    this.write(__privateGet3(this, _helper2));
  };
  _writeUnsignedInt = /* @__PURE__ */ new WeakSet();
  writeUnsignedInt_fn = function(value, width = measureUnsignedInt(value)) {
    let pos = 0;
    switch (width) {
      case 6:
        __privateGet3(this, _helperView2).setUint8(pos++, value / 2 ** 40 | 0);
      case 5:
        __privateGet3(this, _helperView2).setUint8(pos++, value / 2 ** 32 | 0);
      case 4:
        __privateGet3(this, _helperView2).setUint8(pos++, value >> 24);
      case 3:
        __privateGet3(this, _helperView2).setUint8(pos++, value >> 16);
      case 2:
        __privateGet3(this, _helperView2).setUint8(pos++, value >> 8);
      case 1:
        __privateGet3(this, _helperView2).setUint8(pos++, value);
        break;
      default:
        throw new Error("Bad UINT size " + width);
    }
    this.write(__privateGet3(this, _helper2).subarray(0, pos));
  };
  _writeString = /* @__PURE__ */ new WeakSet();
  writeString_fn = function(str) {
    this.write(new Uint8Array(str.split("").map((x) => x.charCodeAt(0))));
  };
  var _target3;
  var _buffer2;
  var _bytes2;
  var _ensureSize2;
  var ensureSize_fn4;
  var ArrayBufferTargetWriter2 = class extends Writer3 {
    constructor(target2) {
      super();
      __privateAdd3(this, _ensureSize2);
      __privateAdd3(this, _target3, void 0);
      __privateAdd3(this, _buffer2, new ArrayBuffer(2 ** 16));
      __privateAdd3(this, _bytes2, new Uint8Array(__privateGet3(this, _buffer2)));
      __privateSet3(this, _target3, target2);
    }
    write(data) {
      __privateMethod3(this, _ensureSize2, ensureSize_fn4).call(this, this.pos + data.byteLength);
      __privateGet3(this, _bytes2).set(data, this.pos);
      this.pos += data.byteLength;
    }
    finalize() {
      __privateMethod3(this, _ensureSize2, ensureSize_fn4).call(this, this.pos);
      __privateGet3(this, _target3).buffer = __privateGet3(this, _buffer2).slice(0, this.pos);
    }
  };
  _target3 = /* @__PURE__ */ new WeakMap();
  _buffer2 = /* @__PURE__ */ new WeakMap();
  _bytes2 = /* @__PURE__ */ new WeakMap();
  _ensureSize2 = /* @__PURE__ */ new WeakSet();
  ensureSize_fn4 = function(size) {
    let newLength = __privateGet3(this, _buffer2).byteLength;
    while (newLength < size)
      newLength *= 2;
    if (newLength === __privateGet3(this, _buffer2).byteLength)
      return;
    let newBuffer = new ArrayBuffer(newLength);
    let newBytes = new Uint8Array(newBuffer);
    newBytes.set(__privateGet3(this, _bytes2), 0);
    __privateSet3(this, _buffer2, newBuffer);
    __privateSet3(this, _bytes2, newBytes);
  };
  var _trackingWrites;
  var _trackedWrites;
  var _trackedStart;
  var _trackedEnd;
  var BaseStreamTargetWriter = class extends Writer3 {
    constructor(target2) {
      super();
      this.target = target2;
      __privateAdd3(this, _trackingWrites, false);
      __privateAdd3(this, _trackedWrites, void 0);
      __privateAdd3(this, _trackedStart, void 0);
      __privateAdd3(this, _trackedEnd, void 0);
    }
    write(data) {
      if (!__privateGet3(this, _trackingWrites))
        return;
      let pos = this.pos;
      if (pos < __privateGet3(this, _trackedStart)) {
        if (pos + data.byteLength <= __privateGet3(this, _trackedStart))
          return;
        data = data.subarray(__privateGet3(this, _trackedStart) - pos);
        pos = 0;
      }
      let neededSize = pos + data.byteLength - __privateGet3(this, _trackedStart);
      let newLength = __privateGet3(this, _trackedWrites).byteLength;
      while (newLength < neededSize)
        newLength *= 2;
      if (newLength !== __privateGet3(this, _trackedWrites).byteLength) {
        let copy = new Uint8Array(newLength);
        copy.set(__privateGet3(this, _trackedWrites), 0);
        __privateSet3(this, _trackedWrites, copy);
      }
      __privateGet3(this, _trackedWrites).set(data, pos - __privateGet3(this, _trackedStart));
      __privateSet3(this, _trackedEnd, Math.max(__privateGet3(this, _trackedEnd), pos + data.byteLength));
    }
    startTrackingWrites() {
      __privateSet3(this, _trackingWrites, true);
      __privateSet3(this, _trackedWrites, new Uint8Array(2 ** 10));
      __privateSet3(this, _trackedStart, this.pos);
      __privateSet3(this, _trackedEnd, this.pos);
    }
    getTrackedWrites() {
      if (!__privateGet3(this, _trackingWrites)) {
        throw new Error("Can't get tracked writes since nothing was tracked.");
      }
      let slice = __privateGet3(this, _trackedWrites).subarray(0, __privateGet3(this, _trackedEnd) - __privateGet3(this, _trackedStart));
      let result = {
        data: slice,
        start: __privateGet3(this, _trackedStart),
        end: __privateGet3(this, _trackedEnd)
      };
      __privateSet3(this, _trackedWrites, void 0);
      __privateSet3(this, _trackingWrites, false);
      return result;
    }
  };
  _trackingWrites = /* @__PURE__ */ new WeakMap();
  _trackedWrites = /* @__PURE__ */ new WeakMap();
  _trackedStart = /* @__PURE__ */ new WeakMap();
  _trackedEnd = /* @__PURE__ */ new WeakMap();
  var _sections2;
  var _lastFlushEnd;
  var _ensureMonotonicity;
  var StreamTargetWriter2 = class extends BaseStreamTargetWriter {
    constructor(target2, ensureMonotonicity) {
      super(target2);
      __privateAdd3(this, _sections2, []);
      __privateAdd3(this, _lastFlushEnd, 0);
      __privateAdd3(this, _ensureMonotonicity, void 0);
      __privateSet3(this, _ensureMonotonicity, ensureMonotonicity);
    }
    write(data) {
      super.write(data);
      __privateGet3(this, _sections2).push({
        data: data.slice(),
        start: this.pos
      });
      this.pos += data.byteLength;
    }
    flush() {
      if (__privateGet3(this, _sections2).length === 0)
        return;
      let chunks = [];
      let sorted = [...__privateGet3(this, _sections2)].sort((a, b) => a.start - b.start);
      chunks.push({
        start: sorted[0].start,
        size: sorted[0].data.byteLength
      });
      for (let i = 1; i < sorted.length; i++) {
        let lastChunk = chunks[chunks.length - 1];
        let section = sorted[i];
        if (section.start <= lastChunk.start + lastChunk.size) {
          lastChunk.size = Math.max(lastChunk.size, section.start + section.data.byteLength - lastChunk.start);
        } else {
          chunks.push({
            start: section.start,
            size: section.data.byteLength
          });
        }
      }
      for (let chunk of chunks) {
        chunk.data = new Uint8Array(chunk.size);
        for (let section of __privateGet3(this, _sections2)) {
          if (chunk.start <= section.start && section.start < chunk.start + chunk.size) {
            chunk.data.set(section.data, section.start - chunk.start);
          }
        }
        if (__privateGet3(this, _ensureMonotonicity) && chunk.start < __privateGet3(this, _lastFlushEnd)) {
          throw new Error("Internal error: Monotonicity violation.");
        }
        this.target.options.onData?.(chunk.data, chunk.start);
        __privateSet3(this, _lastFlushEnd, chunk.start + chunk.data.byteLength);
      }
      __privateGet3(this, _sections2).length = 0;
    }
    finalize() {
    }
  };
  _sections2 = /* @__PURE__ */ new WeakMap();
  _lastFlushEnd = /* @__PURE__ */ new WeakMap();
  _ensureMonotonicity = /* @__PURE__ */ new WeakMap();
  var DEFAULT_CHUNK_SIZE2 = 2 ** 24;
  var MAX_CHUNKS_AT_ONCE2 = 2;
  var _chunkSize2;
  var _chunks2;
  var _lastFlushEnd2;
  var _ensureMonotonicity2;
  var _writeDataIntoChunks2;
  var writeDataIntoChunks_fn2;
  var _insertSectionIntoChunk2;
  var insertSectionIntoChunk_fn2;
  var _createChunk2;
  var createChunk_fn2;
  var _flushChunks2;
  var flushChunks_fn2;
  var ChunkedStreamTargetWriter = class extends BaseStreamTargetWriter {
    constructor(target2, ensureMonotonicity) {
      super(target2);
      __privateAdd3(this, _writeDataIntoChunks2);
      __privateAdd3(this, _insertSectionIntoChunk2);
      __privateAdd3(this, _createChunk2);
      __privateAdd3(this, _flushChunks2);
      __privateAdd3(this, _chunkSize2, void 0);
      __privateAdd3(this, _chunks2, []);
      __privateAdd3(this, _lastFlushEnd2, 0);
      __privateAdd3(this, _ensureMonotonicity2, void 0);
      __privateSet3(this, _chunkSize2, target2.options?.chunkSize ?? DEFAULT_CHUNK_SIZE2);
      __privateSet3(this, _ensureMonotonicity2, ensureMonotonicity);
      if (!Number.isInteger(__privateGet3(this, _chunkSize2)) || __privateGet3(this, _chunkSize2) < 2 ** 10) {
        throw new Error("Invalid StreamTarget options: chunkSize must be an integer not smaller than 1024.");
      }
    }
    write(data) {
      super.write(data);
      __privateMethod3(this, _writeDataIntoChunks2, writeDataIntoChunks_fn2).call(this, data, this.pos);
      __privateMethod3(this, _flushChunks2, flushChunks_fn2).call(this);
      this.pos += data.byteLength;
    }
    finalize() {
      __privateMethod3(this, _flushChunks2, flushChunks_fn2).call(this, true);
    }
  };
  _chunkSize2 = /* @__PURE__ */ new WeakMap();
  _chunks2 = /* @__PURE__ */ new WeakMap();
  _lastFlushEnd2 = /* @__PURE__ */ new WeakMap();
  _ensureMonotonicity2 = /* @__PURE__ */ new WeakMap();
  _writeDataIntoChunks2 = /* @__PURE__ */ new WeakSet();
  writeDataIntoChunks_fn2 = function(data, position) {
    let chunkIndex = __privateGet3(this, _chunks2).findIndex((x) => x.start <= position && position < x.start + __privateGet3(this, _chunkSize2));
    if (chunkIndex === -1)
      chunkIndex = __privateMethod3(this, _createChunk2, createChunk_fn2).call(this, position);
    let chunk = __privateGet3(this, _chunks2)[chunkIndex];
    let relativePosition = position - chunk.start;
    let toWrite = data.subarray(0, Math.min(__privateGet3(this, _chunkSize2) - relativePosition, data.byteLength));
    chunk.data.set(toWrite, relativePosition);
    let section = {
      start: relativePosition,
      end: relativePosition + toWrite.byteLength
    };
    __privateMethod3(this, _insertSectionIntoChunk2, insertSectionIntoChunk_fn2).call(this, chunk, section);
    if (chunk.written[0].start === 0 && chunk.written[0].end === __privateGet3(this, _chunkSize2)) {
      chunk.shouldFlush = true;
    }
    if (__privateGet3(this, _chunks2).length > MAX_CHUNKS_AT_ONCE2) {
      for (let i = 0; i < __privateGet3(this, _chunks2).length - 1; i++) {
        __privateGet3(this, _chunks2)[i].shouldFlush = true;
      }
      __privateMethod3(this, _flushChunks2, flushChunks_fn2).call(this);
    }
    if (toWrite.byteLength < data.byteLength) {
      __privateMethod3(this, _writeDataIntoChunks2, writeDataIntoChunks_fn2).call(this, data.subarray(toWrite.byteLength), position + toWrite.byteLength);
    }
  };
  _insertSectionIntoChunk2 = /* @__PURE__ */ new WeakSet();
  insertSectionIntoChunk_fn2 = function(chunk, section) {
    let low = 0;
    let high = chunk.written.length - 1;
    let index = -1;
    while (low <= high) {
      let mid = Math.floor(low + (high - low + 1) / 2);
      if (chunk.written[mid].start <= section.start) {
        low = mid + 1;
        index = mid;
      } else {
        high = mid - 1;
      }
    }
    chunk.written.splice(index + 1, 0, section);
    if (index === -1 || chunk.written[index].end < section.start)
      index++;
    while (index < chunk.written.length - 1 && chunk.written[index].end >= chunk.written[index + 1].start) {
      chunk.written[index].end = Math.max(chunk.written[index].end, chunk.written[index + 1].end);
      chunk.written.splice(index + 1, 1);
    }
  };
  _createChunk2 = /* @__PURE__ */ new WeakSet();
  createChunk_fn2 = function(includesPosition) {
    let start = Math.floor(includesPosition / __privateGet3(this, _chunkSize2)) * __privateGet3(this, _chunkSize2);
    let chunk = {
      start,
      data: new Uint8Array(__privateGet3(this, _chunkSize2)),
      written: [],
      shouldFlush: false
    };
    __privateGet3(this, _chunks2).push(chunk);
    __privateGet3(this, _chunks2).sort((a, b) => a.start - b.start);
    return __privateGet3(this, _chunks2).indexOf(chunk);
  };
  _flushChunks2 = /* @__PURE__ */ new WeakSet();
  flushChunks_fn2 = function(force = false) {
    for (let i = 0; i < __privateGet3(this, _chunks2).length; i++) {
      let chunk = __privateGet3(this, _chunks2)[i];
      if (!chunk.shouldFlush && !force)
        continue;
      for (let section of chunk.written) {
        if (__privateGet3(this, _ensureMonotonicity2) && chunk.start + section.start < __privateGet3(this, _lastFlushEnd2)) {
          throw new Error("Internal error: Monotonicity violation.");
        }
        this.target.options.onData?.(
          chunk.data.subarray(section.start, section.end),
          chunk.start + section.start
        );
        __privateSet3(this, _lastFlushEnd2, chunk.start + section.end);
      }
      __privateGet3(this, _chunks2).splice(i--, 1);
    }
  };
  var FileSystemWritableFileStreamTargetWriter2 = class extends ChunkedStreamTargetWriter {
    constructor(target2, ensureMonotonicity) {
      super(new StreamTarget2({
        onData: (data, position) => target2.stream.write({
          type: "write",
          data,
          position
        }),
        chunked: true,
        chunkSize: target2.options?.chunkSize
      }), ensureMonotonicity);
    }
  };
  var VIDEO_TRACK_NUMBER = 1;
  var AUDIO_TRACK_NUMBER = 2;
  var SUBTITLE_TRACK_NUMBER = 3;
  var VIDEO_TRACK_TYPE = 1;
  var AUDIO_TRACK_TYPE = 2;
  var SUBTITLE_TRACK_TYPE = 17;
  var MAX_CHUNK_LENGTH_MS = 2 ** 15;
  var CODEC_PRIVATE_MAX_SIZE = 2 ** 12;
  var APP_NAME = "https://github.com/Vanilagy/webm-muxer";
  var SEGMENT_SIZE_BYTES = 6;
  var CLUSTER_SIZE_BYTES = 5;
  var FIRST_TIMESTAMP_BEHAVIORS2 = ["strict", "offset", "permissive"];
  var _options2;
  var _writer2;
  var _segment;
  var _segmentInfo;
  var _seekHead;
  var _tracksElement;
  var _segmentDuration;
  var _colourElement;
  var _videoCodecPrivate;
  var _audioCodecPrivate;
  var _subtitleCodecPrivate;
  var _cues;
  var _currentCluster;
  var _currentClusterTimestamp;
  var _duration;
  var _videoChunkQueue;
  var _audioChunkQueue;
  var _subtitleChunkQueue;
  var _firstVideoTimestamp;
  var _firstAudioTimestamp;
  var _lastVideoTimestamp;
  var _lastAudioTimestamp;
  var _lastSubtitleTimestamp;
  var _colorSpace;
  var _finalized2;
  var _validateOptions2;
  var validateOptions_fn2;
  var _createFileHeader;
  var createFileHeader_fn;
  var _writeEBMLHeader;
  var writeEBMLHeader_fn;
  var _createCodecPrivatePlaceholders;
  var createCodecPrivatePlaceholders_fn;
  var _createColourElement;
  var createColourElement_fn;
  var _createSeekHead;
  var createSeekHead_fn;
  var _createSegmentInfo;
  var createSegmentInfo_fn;
  var _createTracks;
  var createTracks_fn;
  var _createSegment;
  var createSegment_fn;
  var _createCues;
  var createCues_fn;
  var _maybeFlushStreamingTargetWriter2;
  var maybeFlushStreamingTargetWriter_fn2;
  var _segmentDataOffset;
  var segmentDataOffset_get;
  var _writeVideoDecoderConfig;
  var writeVideoDecoderConfig_fn;
  var _fixVP9ColorSpace;
  var fixVP9ColorSpace_fn;
  var _writeSubtitleChunks;
  var writeSubtitleChunks_fn;
  var _createInternalChunk;
  var createInternalChunk_fn;
  var _validateTimestamp2;
  var validateTimestamp_fn2;
  var _writeBlock;
  var writeBlock_fn;
  var _createCodecPrivateElement;
  var createCodecPrivateElement_fn;
  var _writeCodecPrivate;
  var writeCodecPrivate_fn;
  var _createNewCluster;
  var createNewCluster_fn;
  var _finalizeCurrentCluster;
  var finalizeCurrentCluster_fn;
  var _ensureNotFinalized2;
  var ensureNotFinalized_fn2;
  var Muxer2 = class {
    constructor(options) {
      __privateAdd3(this, _validateOptions2);
      __privateAdd3(this, _createFileHeader);
      __privateAdd3(this, _writeEBMLHeader);
      __privateAdd3(this, _createCodecPrivatePlaceholders);
      __privateAdd3(this, _createColourElement);
      __privateAdd3(this, _createSeekHead);
      __privateAdd3(this, _createSegmentInfo);
      __privateAdd3(this, _createTracks);
      __privateAdd3(this, _createSegment);
      __privateAdd3(this, _createCues);
      __privateAdd3(this, _maybeFlushStreamingTargetWriter2);
      __privateAdd3(this, _segmentDataOffset);
      __privateAdd3(this, _writeVideoDecoderConfig);
      __privateAdd3(this, _fixVP9ColorSpace);
      __privateAdd3(this, _writeSubtitleChunks);
      __privateAdd3(this, _createInternalChunk);
      __privateAdd3(this, _validateTimestamp2);
      __privateAdd3(this, _writeBlock);
      __privateAdd3(this, _createCodecPrivateElement);
      __privateAdd3(this, _writeCodecPrivate);
      __privateAdd3(this, _createNewCluster);
      __privateAdd3(this, _finalizeCurrentCluster);
      __privateAdd3(this, _ensureNotFinalized2);
      __privateAdd3(this, _options2, void 0);
      __privateAdd3(this, _writer2, void 0);
      __privateAdd3(this, _segment, void 0);
      __privateAdd3(this, _segmentInfo, void 0);
      __privateAdd3(this, _seekHead, void 0);
      __privateAdd3(this, _tracksElement, void 0);
      __privateAdd3(this, _segmentDuration, void 0);
      __privateAdd3(this, _colourElement, void 0);
      __privateAdd3(this, _videoCodecPrivate, void 0);
      __privateAdd3(this, _audioCodecPrivate, void 0);
      __privateAdd3(this, _subtitleCodecPrivate, void 0);
      __privateAdd3(this, _cues, void 0);
      __privateAdd3(this, _currentCluster, void 0);
      __privateAdd3(this, _currentClusterTimestamp, void 0);
      __privateAdd3(this, _duration, 0);
      __privateAdd3(this, _videoChunkQueue, []);
      __privateAdd3(this, _audioChunkQueue, []);
      __privateAdd3(this, _subtitleChunkQueue, []);
      __privateAdd3(this, _firstVideoTimestamp, void 0);
      __privateAdd3(this, _firstAudioTimestamp, void 0);
      __privateAdd3(this, _lastVideoTimestamp, -1);
      __privateAdd3(this, _lastAudioTimestamp, -1);
      __privateAdd3(this, _lastSubtitleTimestamp, -1);
      __privateAdd3(this, _colorSpace, void 0);
      __privateAdd3(this, _finalized2, false);
      __privateMethod3(this, _validateOptions2, validateOptions_fn2).call(this, options);
      __privateSet3(this, _options2, {
        type: "webm",
        firstTimestampBehavior: "strict",
        ...options
      });
      this.target = options.target;
      let ensureMonotonicity = !!__privateGet3(this, _options2).streaming;
      if (options.target instanceof ArrayBufferTarget2) {
        __privateSet3(this, _writer2, new ArrayBufferTargetWriter2(options.target));
      } else if (options.target instanceof StreamTarget2) {
        __privateSet3(this, _writer2, options.target.options?.chunked ? new ChunkedStreamTargetWriter(options.target, ensureMonotonicity) : new StreamTargetWriter2(options.target, ensureMonotonicity));
      } else if (options.target instanceof FileSystemWritableFileStreamTarget2) {
        __privateSet3(this, _writer2, new FileSystemWritableFileStreamTargetWriter2(options.target, ensureMonotonicity));
      } else {
        throw new Error(`Invalid target: ${options.target}`);
      }
      __privateMethod3(this, _createFileHeader, createFileHeader_fn).call(this);
    }
    addVideoChunk(chunk, meta, timestamp) {
      if (!(chunk instanceof EncodedVideoChunk)) {
        throw new TypeError("addVideoChunk's first argument (chunk) must be of type EncodedVideoChunk.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addVideoChunk's second argument (meta), when provided, must be an object.");
      }
      if (timestamp !== void 0 && (!Number.isFinite(timestamp) || timestamp < 0)) {
        throw new TypeError(
          "addVideoChunk's third argument (timestamp), when provided, must be a non-negative real number."
        );
      }
      let data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      this.addVideoChunkRaw(data, chunk.type, timestamp ?? chunk.timestamp, meta);
    }
    addVideoChunkRaw(data, type, timestamp, meta) {
      if (!(data instanceof Uint8Array)) {
        throw new TypeError("addVideoChunkRaw's first argument (data) must be an instance of Uint8Array.");
      }
      if (type !== "key" && type !== "delta") {
        throw new TypeError("addVideoChunkRaw's second argument (type) must be either 'key' or 'delta'.");
      }
      if (!Number.isFinite(timestamp) || timestamp < 0) {
        throw new TypeError("addVideoChunkRaw's third argument (timestamp) must be a non-negative real number.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addVideoChunkRaw's fourth argument (meta), when provided, must be an object.");
      }
      __privateMethod3(this, _ensureNotFinalized2, ensureNotFinalized_fn2).call(this);
      if (!__privateGet3(this, _options2).video)
        throw new Error("No video track declared.");
      if (__privateGet3(this, _firstVideoTimestamp) === void 0)
        __privateSet3(this, _firstVideoTimestamp, timestamp);
      if (meta)
        __privateMethod3(this, _writeVideoDecoderConfig, writeVideoDecoderConfig_fn).call(this, meta);
      let videoChunk = __privateMethod3(this, _createInternalChunk, createInternalChunk_fn).call(this, data, type, timestamp, VIDEO_TRACK_NUMBER);
      if (__privateGet3(this, _options2).video.codec === "V_VP9")
        __privateMethod3(this, _fixVP9ColorSpace, fixVP9ColorSpace_fn).call(this, videoChunk);
      __privateSet3(this, _lastVideoTimestamp, videoChunk.timestamp);
      while (__privateGet3(this, _audioChunkQueue).length > 0 && __privateGet3(this, _audioChunkQueue)[0].timestamp <= videoChunk.timestamp) {
        let audioChunk = __privateGet3(this, _audioChunkQueue).shift();
        __privateMethod3(this, _writeBlock, writeBlock_fn).call(this, audioChunk, false);
      }
      if (!__privateGet3(this, _options2).audio || videoChunk.timestamp <= __privateGet3(this, _lastAudioTimestamp)) {
        __privateMethod3(this, _writeBlock, writeBlock_fn).call(this, videoChunk, true);
      } else {
        __privateGet3(this, _videoChunkQueue).push(videoChunk);
      }
      __privateMethod3(this, _writeSubtitleChunks, writeSubtitleChunks_fn).call(this);
      __privateMethod3(this, _maybeFlushStreamingTargetWriter2, maybeFlushStreamingTargetWriter_fn2).call(this);
    }
    addAudioChunk(chunk, meta, timestamp) {
      if (!(chunk instanceof EncodedAudioChunk)) {
        throw new TypeError("addAudioChunk's first argument (chunk) must be of type EncodedAudioChunk.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addAudioChunk's second argument (meta), when provided, must be an object.");
      }
      if (timestamp !== void 0 && (!Number.isFinite(timestamp) || timestamp < 0)) {
        throw new TypeError(
          "addAudioChunk's third argument (timestamp), when provided, must be a non-negative real number."
        );
      }
      let data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      this.addAudioChunkRaw(data, chunk.type, timestamp ?? chunk.timestamp, meta);
    }
    addAudioChunkRaw(data, type, timestamp, meta) {
      if (!(data instanceof Uint8Array)) {
        throw new TypeError("addAudioChunkRaw's first argument (data) must be an instance of Uint8Array.");
      }
      if (type !== "key" && type !== "delta") {
        throw new TypeError("addAudioChunkRaw's second argument (type) must be either 'key' or 'delta'.");
      }
      if (!Number.isFinite(timestamp) || timestamp < 0) {
        throw new TypeError("addAudioChunkRaw's third argument (timestamp) must be a non-negative real number.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addAudioChunkRaw's fourth argument (meta), when provided, must be an object.");
      }
      __privateMethod3(this, _ensureNotFinalized2, ensureNotFinalized_fn2).call(this);
      if (!__privateGet3(this, _options2).audio)
        throw new Error("No audio track declared.");
      if (__privateGet3(this, _firstAudioTimestamp) === void 0)
        __privateSet3(this, _firstAudioTimestamp, timestamp);
      if (meta?.decoderConfig) {
        if (__privateGet3(this, _options2).streaming) {
          __privateSet3(this, _audioCodecPrivate, __privateMethod3(this, _createCodecPrivateElement, createCodecPrivateElement_fn).call(this, meta.decoderConfig.description));
        } else {
          __privateMethod3(this, _writeCodecPrivate, writeCodecPrivate_fn).call(this, __privateGet3(this, _audioCodecPrivate), meta.decoderConfig.description);
        }
      }
      let audioChunk = __privateMethod3(this, _createInternalChunk, createInternalChunk_fn).call(this, data, type, timestamp, AUDIO_TRACK_NUMBER);
      __privateSet3(this, _lastAudioTimestamp, audioChunk.timestamp);
      while (__privateGet3(this, _videoChunkQueue).length > 0 && __privateGet3(this, _videoChunkQueue)[0].timestamp <= audioChunk.timestamp) {
        let videoChunk = __privateGet3(this, _videoChunkQueue).shift();
        __privateMethod3(this, _writeBlock, writeBlock_fn).call(this, videoChunk, true);
      }
      if (!__privateGet3(this, _options2).video || audioChunk.timestamp <= __privateGet3(this, _lastVideoTimestamp)) {
        __privateMethod3(this, _writeBlock, writeBlock_fn).call(this, audioChunk, !__privateGet3(this, _options2).video);
      } else {
        __privateGet3(this, _audioChunkQueue).push(audioChunk);
      }
      __privateMethod3(this, _writeSubtitleChunks, writeSubtitleChunks_fn).call(this);
      __privateMethod3(this, _maybeFlushStreamingTargetWriter2, maybeFlushStreamingTargetWriter_fn2).call(this);
    }
    addSubtitleChunk(chunk, meta, timestamp) {
      if (typeof chunk !== "object" || !chunk) {
        throw new TypeError("addSubtitleChunk's first argument (chunk) must be an object.");
      } else {
        if (!(chunk.body instanceof Uint8Array)) {
          throw new TypeError("body must be an instance of Uint8Array.");
        }
        if (!Number.isFinite(chunk.timestamp) || chunk.timestamp < 0) {
          throw new TypeError("timestamp must be a non-negative real number.");
        }
        if (!Number.isFinite(chunk.duration) || chunk.duration < 0) {
          throw new TypeError("duration must be a non-negative real number.");
        }
        if (chunk.additions && !(chunk.additions instanceof Uint8Array)) {
          throw new TypeError("additions, when present, must be an instance of Uint8Array.");
        }
      }
      if (typeof meta !== "object") {
        throw new TypeError("addSubtitleChunk's second argument (meta) must be an object.");
      }
      __privateMethod3(this, _ensureNotFinalized2, ensureNotFinalized_fn2).call(this);
      if (!__privateGet3(this, _options2).subtitles)
        throw new Error("No subtitle track declared.");
      if (meta?.decoderConfig) {
        if (__privateGet3(this, _options2).streaming) {
          __privateSet3(this, _subtitleCodecPrivate, __privateMethod3(this, _createCodecPrivateElement, createCodecPrivateElement_fn).call(this, meta.decoderConfig.description));
        } else {
          __privateMethod3(this, _writeCodecPrivate, writeCodecPrivate_fn).call(this, __privateGet3(this, _subtitleCodecPrivate), meta.decoderConfig.description);
        }
      }
      let subtitleChunk = __privateMethod3(this, _createInternalChunk, createInternalChunk_fn).call(this, chunk.body, "key", timestamp ?? chunk.timestamp, SUBTITLE_TRACK_NUMBER, chunk.duration, chunk.additions);
      __privateSet3(this, _lastSubtitleTimestamp, subtitleChunk.timestamp);
      __privateGet3(this, _subtitleChunkQueue).push(subtitleChunk);
      __privateMethod3(this, _writeSubtitleChunks, writeSubtitleChunks_fn).call(this);
      __privateMethod3(this, _maybeFlushStreamingTargetWriter2, maybeFlushStreamingTargetWriter_fn2).call(this);
    }
    finalize() {
      if (__privateGet3(this, _finalized2)) {
        throw new Error("Cannot finalize a muxer more than once.");
      }
      while (__privateGet3(this, _videoChunkQueue).length > 0)
        __privateMethod3(this, _writeBlock, writeBlock_fn).call(this, __privateGet3(this, _videoChunkQueue).shift(), true);
      while (__privateGet3(this, _audioChunkQueue).length > 0)
        __privateMethod3(this, _writeBlock, writeBlock_fn).call(this, __privateGet3(this, _audioChunkQueue).shift(), true);
      while (__privateGet3(this, _subtitleChunkQueue).length > 0 && __privateGet3(this, _subtitleChunkQueue)[0].timestamp <= __privateGet3(this, _duration)) {
        __privateMethod3(this, _writeBlock, writeBlock_fn).call(this, __privateGet3(this, _subtitleChunkQueue).shift(), false);
      }
      if (__privateGet3(this, _currentCluster) && !__privateGet3(this, _options2).streaming) {
        __privateMethod3(this, _finalizeCurrentCluster, finalizeCurrentCluster_fn).call(this);
      }
      __privateGet3(this, _writer2).writeEBML(__privateGet3(this, _cues));
      if (!__privateGet3(this, _options2).streaming) {
        let endPos = __privateGet3(this, _writer2).pos;
        let segmentSize = __privateGet3(this, _writer2).pos - __privateGet3(this, _segmentDataOffset, segmentDataOffset_get);
        __privateGet3(this, _writer2).seek(__privateGet3(this, _writer2).offsets.get(__privateGet3(this, _segment)) + 4);
        __privateGet3(this, _writer2).writeEBMLVarInt(segmentSize, SEGMENT_SIZE_BYTES);
        __privateGet3(this, _segmentDuration).data = new EBMLFloat64(__privateGet3(this, _duration));
        __privateGet3(this, _writer2).seek(__privateGet3(this, _writer2).offsets.get(__privateGet3(this, _segmentDuration)));
        __privateGet3(this, _writer2).writeEBML(__privateGet3(this, _segmentDuration));
        __privateGet3(this, _seekHead).data[0].data[1].data = __privateGet3(this, _writer2).offsets.get(__privateGet3(this, _cues)) - __privateGet3(this, _segmentDataOffset, segmentDataOffset_get);
        __privateGet3(this, _seekHead).data[1].data[1].data = __privateGet3(this, _writer2).offsets.get(__privateGet3(this, _segmentInfo)) - __privateGet3(this, _segmentDataOffset, segmentDataOffset_get);
        __privateGet3(this, _seekHead).data[2].data[1].data = __privateGet3(this, _writer2).offsets.get(__privateGet3(this, _tracksElement)) - __privateGet3(this, _segmentDataOffset, segmentDataOffset_get);
        __privateGet3(this, _writer2).seek(__privateGet3(this, _writer2).offsets.get(__privateGet3(this, _seekHead)));
        __privateGet3(this, _writer2).writeEBML(__privateGet3(this, _seekHead));
        __privateGet3(this, _writer2).seek(endPos);
      }
      __privateMethod3(this, _maybeFlushStreamingTargetWriter2, maybeFlushStreamingTargetWriter_fn2).call(this);
      __privateGet3(this, _writer2).finalize();
      __privateSet3(this, _finalized2, true);
    }
  };
  _options2 = /* @__PURE__ */ new WeakMap();
  _writer2 = /* @__PURE__ */ new WeakMap();
  _segment = /* @__PURE__ */ new WeakMap();
  _segmentInfo = /* @__PURE__ */ new WeakMap();
  _seekHead = /* @__PURE__ */ new WeakMap();
  _tracksElement = /* @__PURE__ */ new WeakMap();
  _segmentDuration = /* @__PURE__ */ new WeakMap();
  _colourElement = /* @__PURE__ */ new WeakMap();
  _videoCodecPrivate = /* @__PURE__ */ new WeakMap();
  _audioCodecPrivate = /* @__PURE__ */ new WeakMap();
  _subtitleCodecPrivate = /* @__PURE__ */ new WeakMap();
  _cues = /* @__PURE__ */ new WeakMap();
  _currentCluster = /* @__PURE__ */ new WeakMap();
  _currentClusterTimestamp = /* @__PURE__ */ new WeakMap();
  _duration = /* @__PURE__ */ new WeakMap();
  _videoChunkQueue = /* @__PURE__ */ new WeakMap();
  _audioChunkQueue = /* @__PURE__ */ new WeakMap();
  _subtitleChunkQueue = /* @__PURE__ */ new WeakMap();
  _firstVideoTimestamp = /* @__PURE__ */ new WeakMap();
  _firstAudioTimestamp = /* @__PURE__ */ new WeakMap();
  _lastVideoTimestamp = /* @__PURE__ */ new WeakMap();
  _lastAudioTimestamp = /* @__PURE__ */ new WeakMap();
  _lastSubtitleTimestamp = /* @__PURE__ */ new WeakMap();
  _colorSpace = /* @__PURE__ */ new WeakMap();
  _finalized2 = /* @__PURE__ */ new WeakMap();
  _validateOptions2 = /* @__PURE__ */ new WeakSet();
  validateOptions_fn2 = function(options) {
    if (typeof options !== "object") {
      throw new TypeError("The muxer requires an options object to be passed to its constructor.");
    }
    if (!(options.target instanceof Target2)) {
      throw new TypeError("The target must be provided and an instance of Target.");
    }
    if (options.video) {
      if (typeof options.video.codec !== "string") {
        throw new TypeError(`Invalid video codec: ${options.video.codec}. Must be a string.`);
      }
      if (!Number.isInteger(options.video.width) || options.video.width <= 0) {
        throw new TypeError(`Invalid video width: ${options.video.width}. Must be a positive integer.`);
      }
      if (!Number.isInteger(options.video.height) || options.video.height <= 0) {
        throw new TypeError(`Invalid video height: ${options.video.height}. Must be a positive integer.`);
      }
      if (options.video.frameRate !== void 0) {
        if (!Number.isFinite(options.video.frameRate) || options.video.frameRate <= 0) {
          throw new TypeError(
            `Invalid video frame rate: ${options.video.frameRate}. Must be a positive number.`
          );
        }
      }
      if (options.video.alpha !== void 0 && typeof options.video.alpha !== "boolean") {
        throw new TypeError(`Invalid video alpha: ${options.video.alpha}. Must be a boolean.`);
      }
    }
    if (options.audio) {
      if (typeof options.audio.codec !== "string") {
        throw new TypeError(`Invalid audio codec: ${options.audio.codec}. Must be a string.`);
      }
      if (!Number.isInteger(options.audio.numberOfChannels) || options.audio.numberOfChannels <= 0) {
        throw new TypeError(
          `Invalid number of audio channels: ${options.audio.numberOfChannels}. Must be a positive integer.`
        );
      }
      if (!Number.isInteger(options.audio.sampleRate) || options.audio.sampleRate <= 0) {
        throw new TypeError(
          `Invalid audio sample rate: ${options.audio.sampleRate}. Must be a positive integer.`
        );
      }
      if (options.audio.bitDepth !== void 0) {
        if (!Number.isInteger(options.audio.bitDepth) || options.audio.bitDepth <= 0) {
          throw new TypeError(
            `Invalid audio bit depth: ${options.audio.bitDepth}. Must be a positive integer.`
          );
        }
      }
    }
    if (options.subtitles) {
      if (typeof options.subtitles.codec !== "string") {
        throw new TypeError(`Invalid subtitles codec: ${options.subtitles.codec}. Must be a string.`);
      }
    }
    if (options.type !== void 0 && !["webm", "matroska"].includes(options.type)) {
      throw new TypeError(`Invalid type: ${options.type}. Must be 'webm' or 'matroska'.`);
    }
    if (options.firstTimestampBehavior && !FIRST_TIMESTAMP_BEHAVIORS2.includes(options.firstTimestampBehavior)) {
      throw new TypeError(`Invalid first timestamp behavior: ${options.firstTimestampBehavior}`);
    }
    if (options.streaming !== void 0 && typeof options.streaming !== "boolean") {
      throw new TypeError(`Invalid streaming option: ${options.streaming}. Must be a boolean.`);
    }
  };
  _createFileHeader = /* @__PURE__ */ new WeakSet();
  createFileHeader_fn = function() {
    if (__privateGet3(this, _writer2) instanceof BaseStreamTargetWriter && __privateGet3(this, _writer2).target.options.onHeader) {
      __privateGet3(this, _writer2).startTrackingWrites();
    }
    __privateMethod3(this, _writeEBMLHeader, writeEBMLHeader_fn).call(this);
    if (!__privateGet3(this, _options2).streaming) {
      __privateMethod3(this, _createSeekHead, createSeekHead_fn).call(this);
    }
    __privateMethod3(this, _createSegmentInfo, createSegmentInfo_fn).call(this);
    __privateMethod3(this, _createCodecPrivatePlaceholders, createCodecPrivatePlaceholders_fn).call(this);
    __privateMethod3(this, _createColourElement, createColourElement_fn).call(this);
    if (!__privateGet3(this, _options2).streaming) {
      __privateMethod3(this, _createTracks, createTracks_fn).call(this);
      __privateMethod3(this, _createSegment, createSegment_fn).call(this);
    } else {
    }
    __privateMethod3(this, _createCues, createCues_fn).call(this);
    __privateMethod3(this, _maybeFlushStreamingTargetWriter2, maybeFlushStreamingTargetWriter_fn2).call(this);
  };
  _writeEBMLHeader = /* @__PURE__ */ new WeakSet();
  writeEBMLHeader_fn = function() {
    let ebmlHeader = { id: 440786851, data: [
      { id: 17030, data: 1 },
      { id: 17143, data: 1 },
      { id: 17138, data: 4 },
      { id: 17139, data: 8 },
      { id: 17026, data: __privateGet3(this, _options2).type ?? "webm" },
      { id: 17031, data: 2 },
      { id: 17029, data: 2 }
    ] };
    __privateGet3(this, _writer2).writeEBML(ebmlHeader);
  };
  _createCodecPrivatePlaceholders = /* @__PURE__ */ new WeakSet();
  createCodecPrivatePlaceholders_fn = function() {
    __privateSet3(this, _videoCodecPrivate, { id: 236, size: 4, data: new Uint8Array(CODEC_PRIVATE_MAX_SIZE) });
    __privateSet3(this, _audioCodecPrivate, { id: 236, size: 4, data: new Uint8Array(CODEC_PRIVATE_MAX_SIZE) });
    __privateSet3(this, _subtitleCodecPrivate, { id: 236, size: 4, data: new Uint8Array(CODEC_PRIVATE_MAX_SIZE) });
  };
  _createColourElement = /* @__PURE__ */ new WeakSet();
  createColourElement_fn = function() {
    __privateSet3(this, _colourElement, { id: 21936, data: [
      { id: 21937, data: 2 },
      { id: 21946, data: 2 },
      { id: 21947, data: 2 },
      { id: 21945, data: 0 }
    ] });
  };
  _createSeekHead = /* @__PURE__ */ new WeakSet();
  createSeekHead_fn = function() {
    const kaxCues = new Uint8Array([28, 83, 187, 107]);
    const kaxInfo = new Uint8Array([21, 73, 169, 102]);
    const kaxTracks = new Uint8Array([22, 84, 174, 107]);
    let seekHead = { id: 290298740, data: [
      { id: 19899, data: [
        { id: 21419, data: kaxCues },
        { id: 21420, size: 5, data: 0 }
      ] },
      { id: 19899, data: [
        { id: 21419, data: kaxInfo },
        { id: 21420, size: 5, data: 0 }
      ] },
      { id: 19899, data: [
        { id: 21419, data: kaxTracks },
        { id: 21420, size: 5, data: 0 }
      ] }
    ] };
    __privateSet3(this, _seekHead, seekHead);
  };
  _createSegmentInfo = /* @__PURE__ */ new WeakSet();
  createSegmentInfo_fn = function() {
    let segmentDuration = { id: 17545, data: new EBMLFloat64(0) };
    __privateSet3(this, _segmentDuration, segmentDuration);
    let segmentInfo = { id: 357149030, data: [
      { id: 2807729, data: 1e6 },
      { id: 19840, data: APP_NAME },
      { id: 22337, data: APP_NAME },
      !__privateGet3(this, _options2).streaming ? segmentDuration : null
    ] };
    __privateSet3(this, _segmentInfo, segmentInfo);
  };
  _createTracks = /* @__PURE__ */ new WeakSet();
  createTracks_fn = function() {
    let tracksElement = { id: 374648427, data: [] };
    __privateSet3(this, _tracksElement, tracksElement);
    if (__privateGet3(this, _options2).video) {
      tracksElement.data.push({ id: 174, data: [
        { id: 215, data: VIDEO_TRACK_NUMBER },
        { id: 29637, data: VIDEO_TRACK_NUMBER },
        { id: 131, data: VIDEO_TRACK_TYPE },
        { id: 134, data: __privateGet3(this, _options2).video.codec },
        __privateGet3(this, _videoCodecPrivate),
        __privateGet3(this, _options2).video.frameRate ? { id: 2352003, data: 1e9 / __privateGet3(this, _options2).video.frameRate } : null,
        { id: 224, data: [
          { id: 176, data: __privateGet3(this, _options2).video.width },
          { id: 186, data: __privateGet3(this, _options2).video.height },
          __privateGet3(this, _options2).video.alpha ? { id: 21440, data: 1 } : null,
          __privateGet3(this, _colourElement)
        ] }
      ] });
    }
    if (__privateGet3(this, _options2).audio) {
      __privateSet3(this, _audioCodecPrivate, __privateGet3(this, _options2).streaming ? __privateGet3(this, _audioCodecPrivate) || null : { id: 236, size: 4, data: new Uint8Array(CODEC_PRIVATE_MAX_SIZE) });
      tracksElement.data.push({ id: 174, data: [
        { id: 215, data: AUDIO_TRACK_NUMBER },
        { id: 29637, data: AUDIO_TRACK_NUMBER },
        { id: 131, data: AUDIO_TRACK_TYPE },
        { id: 134, data: __privateGet3(this, _options2).audio.codec },
        __privateGet3(this, _audioCodecPrivate),
        { id: 225, data: [
          { id: 181, data: new EBMLFloat32(__privateGet3(this, _options2).audio.sampleRate) },
          { id: 159, data: __privateGet3(this, _options2).audio.numberOfChannels },
          __privateGet3(this, _options2).audio.bitDepth ? { id: 25188, data: __privateGet3(this, _options2).audio.bitDepth } : null
        ] }
      ] });
    }
    if (__privateGet3(this, _options2).subtitles) {
      tracksElement.data.push({ id: 174, data: [
        { id: 215, data: SUBTITLE_TRACK_NUMBER },
        { id: 29637, data: SUBTITLE_TRACK_NUMBER },
        { id: 131, data: SUBTITLE_TRACK_TYPE },
        { id: 134, data: __privateGet3(this, _options2).subtitles.codec },
        __privateGet3(this, _subtitleCodecPrivate)
      ] });
    }
  };
  _createSegment = /* @__PURE__ */ new WeakSet();
  createSegment_fn = function() {
    let segment = {
      id: 408125543,
      size: __privateGet3(this, _options2).streaming ? -1 : SEGMENT_SIZE_BYTES,
      data: [
        !__privateGet3(this, _options2).streaming ? __privateGet3(this, _seekHead) : null,
        __privateGet3(this, _segmentInfo),
        __privateGet3(this, _tracksElement)
      ]
    };
    __privateSet3(this, _segment, segment);
    __privateGet3(this, _writer2).writeEBML(segment);
    if (__privateGet3(this, _writer2) instanceof BaseStreamTargetWriter && __privateGet3(this, _writer2).target.options.onHeader) {
      let { data, start } = __privateGet3(this, _writer2).getTrackedWrites();
      __privateGet3(this, _writer2).target.options.onHeader(data, start);
    }
  };
  _createCues = /* @__PURE__ */ new WeakSet();
  createCues_fn = function() {
    __privateSet3(this, _cues, { id: 475249515, data: [] });
  };
  _maybeFlushStreamingTargetWriter2 = /* @__PURE__ */ new WeakSet();
  maybeFlushStreamingTargetWriter_fn2 = function() {
    if (__privateGet3(this, _writer2) instanceof StreamTargetWriter2) {
      __privateGet3(this, _writer2).flush();
    }
  };
  _segmentDataOffset = /* @__PURE__ */ new WeakSet();
  segmentDataOffset_get = function() {
    return __privateGet3(this, _writer2).dataOffsets.get(__privateGet3(this, _segment));
  };
  _writeVideoDecoderConfig = /* @__PURE__ */ new WeakSet();
  writeVideoDecoderConfig_fn = function(meta) {
    if (!meta.decoderConfig)
      return;
    if (meta.decoderConfig.colorSpace) {
      let colorSpace = meta.decoderConfig.colorSpace;
      __privateSet3(this, _colorSpace, colorSpace);
      __privateGet3(this, _colourElement).data = [
        { id: 21937, data: {
          "rgb": 1,
          "bt709": 1,
          "bt470bg": 5,
          "smpte170m": 6
        }[colorSpace.matrix] },
        { id: 21946, data: {
          "bt709": 1,
          "smpte170m": 6,
          "iec61966-2-1": 13
        }[colorSpace.transfer] },
        { id: 21947, data: {
          "bt709": 1,
          "bt470bg": 5,
          "smpte170m": 6
        }[colorSpace.primaries] },
        { id: 21945, data: [1, 2][Number(colorSpace.fullRange)] }
      ];
      if (!__privateGet3(this, _options2).streaming) {
        let endPos = __privateGet3(this, _writer2).pos;
        __privateGet3(this, _writer2).seek(__privateGet3(this, _writer2).offsets.get(__privateGet3(this, _colourElement)));
        __privateGet3(this, _writer2).writeEBML(__privateGet3(this, _colourElement));
        __privateGet3(this, _writer2).seek(endPos);
      }
    }
    if (meta.decoderConfig.description) {
      if (__privateGet3(this, _options2).streaming) {
        __privateSet3(this, _videoCodecPrivate, __privateMethod3(this, _createCodecPrivateElement, createCodecPrivateElement_fn).call(this, meta.decoderConfig.description));
      } else {
        __privateMethod3(this, _writeCodecPrivate, writeCodecPrivate_fn).call(this, __privateGet3(this, _videoCodecPrivate), meta.decoderConfig.description);
      }
    }
  };
  _fixVP9ColorSpace = /* @__PURE__ */ new WeakSet();
  fixVP9ColorSpace_fn = function(chunk) {
    if (chunk.type !== "key")
      return;
    if (!__privateGet3(this, _colorSpace))
      return;
    let i = 0;
    if (readBits(chunk.data, 0, 2) !== 2)
      return;
    i += 2;
    let profile = (readBits(chunk.data, i + 1, i + 2) << 1) + readBits(chunk.data, i + 0, i + 1);
    i += 2;
    if (profile === 3)
      i++;
    let showExistingFrame = readBits(chunk.data, i + 0, i + 1);
    i++;
    if (showExistingFrame)
      return;
    let frameType = readBits(chunk.data, i + 0, i + 1);
    i++;
    if (frameType !== 0)
      return;
    i += 2;
    let syncCode = readBits(chunk.data, i + 0, i + 24);
    i += 24;
    if (syncCode !== 4817730)
      return;
    if (profile >= 2)
      i++;
    let colorSpaceID = {
      "rgb": 7,
      "bt709": 2,
      "bt470bg": 1,
      "smpte170m": 3
    }[__privateGet3(this, _colorSpace).matrix];
    writeBits(chunk.data, i + 0, i + 3, colorSpaceID);
  };
  _writeSubtitleChunks = /* @__PURE__ */ new WeakSet();
  writeSubtitleChunks_fn = function() {
    let lastWrittenMediaTimestamp = Math.min(
      __privateGet3(this, _options2).video ? __privateGet3(this, _lastVideoTimestamp) : Infinity,
      __privateGet3(this, _options2).audio ? __privateGet3(this, _lastAudioTimestamp) : Infinity
    );
    let queue = __privateGet3(this, _subtitleChunkQueue);
    while (queue.length > 0 && queue[0].timestamp <= lastWrittenMediaTimestamp) {
      __privateMethod3(this, _writeBlock, writeBlock_fn).call(this, queue.shift(), !__privateGet3(this, _options2).video && !__privateGet3(this, _options2).audio);
    }
  };
  _createInternalChunk = /* @__PURE__ */ new WeakSet();
  createInternalChunk_fn = function(data, type, timestamp, trackNumber, duration, additions) {
    let adjustedTimestamp = __privateMethod3(this, _validateTimestamp2, validateTimestamp_fn2).call(this, timestamp, trackNumber);
    let internalChunk = {
      data,
      additions,
      type,
      timestamp: adjustedTimestamp,
      duration,
      trackNumber
    };
    return internalChunk;
  };
  _validateTimestamp2 = /* @__PURE__ */ new WeakSet();
  validateTimestamp_fn2 = function(timestamp, trackNumber) {
    let lastTimestamp = trackNumber === VIDEO_TRACK_NUMBER ? __privateGet3(this, _lastVideoTimestamp) : trackNumber === AUDIO_TRACK_NUMBER ? __privateGet3(this, _lastAudioTimestamp) : __privateGet3(this, _lastSubtitleTimestamp);
    if (trackNumber !== SUBTITLE_TRACK_NUMBER) {
      let firstTimestamp = trackNumber === VIDEO_TRACK_NUMBER ? __privateGet3(this, _firstVideoTimestamp) : __privateGet3(this, _firstAudioTimestamp);
      if (__privateGet3(this, _options2).firstTimestampBehavior === "strict" && lastTimestamp === -1 && timestamp !== 0) {
        throw new Error(
          `The first chunk for your media track must have a timestamp of 0 (received ${timestamp}). Non-zero first timestamps are often caused by directly piping frames or audio data from a MediaStreamTrack into the encoder. Their timestamps are typically relative to the age of the document, which is probably what you want.

If you want to offset all timestamps of a track such that the first one is zero, set firstTimestampBehavior: 'offset' in the options.
If you want to allow non-zero first timestamps, set firstTimestampBehavior: 'permissive'.
`
        );
      } else if (__privateGet3(this, _options2).firstTimestampBehavior === "offset") {
        timestamp -= firstTimestamp;
      }
    }
    if (timestamp < lastTimestamp) {
      throw new Error(
        `Timestamps must be monotonically increasing (went from ${lastTimestamp} to ${timestamp}).`
      );
    }
    if (timestamp < 0) {
      throw new Error(`Timestamps must be non-negative (received ${timestamp}).`);
    }
    return timestamp;
  };
  _writeBlock = /* @__PURE__ */ new WeakSet();
  writeBlock_fn = function(chunk, canCreateNewCluster) {
    if (__privateGet3(this, _options2).streaming && !__privateGet3(this, _tracksElement)) {
      __privateMethod3(this, _createTracks, createTracks_fn).call(this);
      __privateMethod3(this, _createSegment, createSegment_fn).call(this);
    }
    let msTimestamp = Math.floor(chunk.timestamp / 1e3);
    let shouldCreateNewClusterFromKeyFrame = canCreateNewCluster && chunk.type === "key" && msTimestamp - __privateGet3(this, _currentClusterTimestamp) >= 1e3;
    if (!__privateGet3(this, _currentCluster) || shouldCreateNewClusterFromKeyFrame) {
      __privateMethod3(this, _createNewCluster, createNewCluster_fn).call(this, msTimestamp);
    }
    let relativeTimestamp = msTimestamp - __privateGet3(this, _currentClusterTimestamp);
    if (relativeTimestamp < 0) {
      return;
    }
    let clusterIsTooLong = relativeTimestamp >= MAX_CHUNK_LENGTH_MS;
    if (clusterIsTooLong) {
      throw new Error(
        `Current Matroska cluster exceeded its maximum allowed length of ${MAX_CHUNK_LENGTH_MS} milliseconds. In order to produce a correct WebM file, you must pass in a key frame at least every ${MAX_CHUNK_LENGTH_MS} milliseconds.`
      );
    }
    let prelude = new Uint8Array(4);
    let view2 = new DataView(prelude.buffer);
    view2.setUint8(0, 128 | chunk.trackNumber);
    view2.setInt16(1, relativeTimestamp, false);
    if (chunk.duration === void 0 && !chunk.additions) {
      view2.setUint8(3, Number(chunk.type === "key") << 7);
      let simpleBlock = { id: 163, data: [
        prelude,
        chunk.data
      ] };
      __privateGet3(this, _writer2).writeEBML(simpleBlock);
    } else {
      let msDuration = Math.floor(chunk.duration / 1e3);
      let blockGroup = { id: 160, data: [
        { id: 161, data: [
          prelude,
          chunk.data
        ] },
        chunk.duration !== void 0 ? { id: 155, data: msDuration } : null,
        chunk.additions ? { id: 30113, data: chunk.additions } : null
      ] };
      __privateGet3(this, _writer2).writeEBML(blockGroup);
    }
    __privateSet3(this, _duration, Math.max(__privateGet3(this, _duration), msTimestamp));
  };
  _createCodecPrivateElement = /* @__PURE__ */ new WeakSet();
  createCodecPrivateElement_fn = function(data) {
    return { id: 25506, size: 4, data: new Uint8Array(data) };
  };
  _writeCodecPrivate = /* @__PURE__ */ new WeakSet();
  writeCodecPrivate_fn = function(element, data) {
    let endPos = __privateGet3(this, _writer2).pos;
    __privateGet3(this, _writer2).seek(__privateGet3(this, _writer2).offsets.get(element));
    let codecPrivateElementSize = 2 + 4 + data.byteLength;
    let voidDataSize = CODEC_PRIVATE_MAX_SIZE - codecPrivateElementSize;
    if (voidDataSize < 0) {
      let newByteLength = data.byteLength + voidDataSize;
      if (data instanceof ArrayBuffer) {
        data = data.slice(0, newByteLength);
      } else {
        data = data.buffer.slice(0, newByteLength);
      }
      voidDataSize = 0;
    }
    element = [
      __privateMethod3(this, _createCodecPrivateElement, createCodecPrivateElement_fn).call(this, data),
      { id: 236, size: 4, data: new Uint8Array(voidDataSize) }
    ];
    __privateGet3(this, _writer2).writeEBML(element);
    __privateGet3(this, _writer2).seek(endPos);
  };
  _createNewCluster = /* @__PURE__ */ new WeakSet();
  createNewCluster_fn = function(timestamp) {
    if (__privateGet3(this, _currentCluster) && !__privateGet3(this, _options2).streaming) {
      __privateMethod3(this, _finalizeCurrentCluster, finalizeCurrentCluster_fn).call(this);
    }
    if (__privateGet3(this, _writer2) instanceof BaseStreamTargetWriter && __privateGet3(this, _writer2).target.options.onCluster) {
      __privateGet3(this, _writer2).startTrackingWrites();
    }
    __privateSet3(this, _currentCluster, {
      id: 524531317,
      size: __privateGet3(this, _options2).streaming ? -1 : CLUSTER_SIZE_BYTES,
      data: [
        { id: 231, data: timestamp }
      ]
    });
    __privateGet3(this, _writer2).writeEBML(__privateGet3(this, _currentCluster));
    __privateSet3(this, _currentClusterTimestamp, timestamp);
    let clusterOffsetFromSegment = __privateGet3(this, _writer2).offsets.get(__privateGet3(this, _currentCluster)) - __privateGet3(this, _segmentDataOffset, segmentDataOffset_get);
    __privateGet3(this, _cues).data.push({ id: 187, data: [
      { id: 179, data: timestamp },
      __privateGet3(this, _options2).video ? { id: 183, data: [
        { id: 247, data: VIDEO_TRACK_NUMBER },
        { id: 241, data: clusterOffsetFromSegment }
      ] } : null,
      __privateGet3(this, _options2).audio ? { id: 183, data: [
        { id: 247, data: AUDIO_TRACK_NUMBER },
        { id: 241, data: clusterOffsetFromSegment }
      ] } : null
    ] });
  };
  _finalizeCurrentCluster = /* @__PURE__ */ new WeakSet();
  finalizeCurrentCluster_fn = function() {
    let clusterSize = __privateGet3(this, _writer2).pos - __privateGet3(this, _writer2).dataOffsets.get(__privateGet3(this, _currentCluster));
    let endPos = __privateGet3(this, _writer2).pos;
    __privateGet3(this, _writer2).seek(__privateGet3(this, _writer2).offsets.get(__privateGet3(this, _currentCluster)) + 4);
    __privateGet3(this, _writer2).writeEBMLVarInt(clusterSize, CLUSTER_SIZE_BYTES);
    __privateGet3(this, _writer2).seek(endPos);
    if (__privateGet3(this, _writer2) instanceof BaseStreamTargetWriter && __privateGet3(this, _writer2).target.options.onCluster) {
      let { data, start } = __privateGet3(this, _writer2).getTrackedWrites();
      __privateGet3(this, _writer2).target.options.onCluster(data, start, __privateGet3(this, _currentClusterTimestamp));
    }
  };
  _ensureNotFinalized2 = /* @__PURE__ */ new WeakSet();
  ensureNotFinalized_fn2 = function() {
    if (__privateGet3(this, _finalized2)) {
      throw new Error("Cannot add new video or audio chunks after the file has been finalized.");
    }
  };
  var timestampRegex = /(?:(\d{2}):)?(\d{2}):(\d{2}).(\d{3})/;
  var textEncoder = new TextEncoder();
  var _options22;
  var _config;
  var _preambleSeen;
  var _preambleBytes;
  var _preambleEmitted;
  var _parseTimestamp;
  var parseTimestamp_fn;
  var _formatTimestamp;
  var formatTimestamp_fn;
  _options22 = /* @__PURE__ */ new WeakMap();
  _config = /* @__PURE__ */ new WeakMap();
  _preambleSeen = /* @__PURE__ */ new WeakMap();
  _preambleBytes = /* @__PURE__ */ new WeakMap();
  _preambleEmitted = /* @__PURE__ */ new WeakMap();
  _parseTimestamp = /* @__PURE__ */ new WeakSet();
  parseTimestamp_fn = function(string) {
    let match = timestampRegex.exec(string);
    if (!match)
      throw new Error("Expected match.");
    return 60 * 60 * 1e3 * Number(match[1] || "0") + 60 * 1e3 * Number(match[2]) + 1e3 * Number(match[3]) + Number(match[4]);
  };
  _formatTimestamp = /* @__PURE__ */ new WeakSet();
  formatTimestamp_fn = function(timestamp) {
    let hours = Math.floor(timestamp / (60 * 60 * 1e3));
    let minutes = Math.floor(timestamp % (60 * 60 * 1e3) / (60 * 1e3));
    let seconds = Math.floor(timestamp % (60 * 1e3) / 1e3);
    let milliseconds = timestamp % 1e3;
    return hours.toString().padStart(2, "0") + ":" + minutes.toString().padStart(2, "0") + ":" + seconds.toString().padStart(2, "0") + "." + milliseconds.toString().padStart(3, "0");
  };

  // src/encoders/WebCodecsEncoder.js
  var rawSetTimeout2 = globalThis.setTimeout.bind(globalThis);
  var CANDIDATES = {
    avc: ["avc1.640034", "avc1.4d0034", "avc1.640028", "avc1.42e01f"],
    vp9: ["vp09.00.10.08", "vp09.00.50.08"],
    av1: ["av01.0.08M.08", "av01.0.04M.08"],
    vp8: ["vp8"]
  };
  var MP4_CODEC = { avc: "avc", av1: "av1", vp9: "vp9" };
  var WEBM_CODEC = { vp9: "V_VP9", vp8: "V_VP8", av1: "V_AV1" };
  var AUDIO = {
    mp4: [
      { encoder: "mp4a.40.2", muxer: "aac" },
      { encoder: "opus", muxer: "opus" }
    ],
    webm: [{ encoder: "opus", muxer: "A_OPUS" }]
  };
  var MP4_FAMILIES = ["avc", "av1"];
  var WEBM_FAMILIES = ["vp9", "vp8", "av1"];
  var _WebCodecsEncoder_instances, bitrateFor_fn, deliversConfig_fn, configure_fn, encodeAudio_fn, fit_fn;
  var _WebCodecsEncoder = class _WebCodecsEncoder extends FrameEncoder {
    constructor(params) {
      super(params);
      __privateAdd(this, _WebCodecsEncoder_instances);
      this.container = params.format === "mp4" ? "mp4" : "webm";
      this.extension = this.container;
      this.mimeType = this.container === "mp4" ? "video/mp4" : "video/webm";
      this.explicitCodec = params.codec || null;
      this.codec = this.explicitCodec || (this.container === "mp4" ? "avc" : "vp9");
      this.bitrate = params.bitrate || 0;
      this.maxQueueSize = params.maxQueueSize ?? 8;
      this.audio = params.audio || null;
      this.audioBitrate = params.audioBitrate || 128e3;
      this.videoEncoder = null;
      this.audioEncoder = null;
      this.audioEnabled = false;
      this.muxer = null;
      this.target = null;
      this.configured = false;
      this.encodeError = null;
      this.frameIndex = 0;
      this.keyInterval = Math.max(1, Math.round((params.framerate || 60) * 2));
      this.savedBlob = null;
      this.fitCanvas = null;
      this.fitCtx = null;
    }
    static isSupported() {
      return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
    }
    async start() {
      if (!_WebCodecsEncoder.isSupported()) {
        throw new Error("WebCodecs (VideoEncoder) is not available in this browser.");
      }
      await super.start();
      this.frameIndex = 0;
      this.encodeError = null;
      await this.dispose();
    }
    async add(canvas) {
      if (this.encodeError) throw this.encodeError;
      if (!this.configured) await __privateMethod(this, _WebCodecsEncoder_instances, configure_fn).call(this, canvas.width, canvas.height);
      const source = __privateMethod(this, _WebCodecsEncoder_instances, fit_fn).call(this, canvas);
      const timestamp = Math.round(this.frameIndex * 1e6 / this.params.framerate);
      const duration = Math.round(1e6 / this.params.framerate);
      const frame = new VideoFrame(source, { timestamp, duration });
      const keyFrame = this.frameIndex % this.keyInterval === 0;
      this.videoEncoder.encode(frame, { keyFrame });
      frame.close();
      this.frameIndex++;
      await super.add();
    }
    /** Wait until the encoder queue drains below the high-water mark. */
    async backpressure() {
      const enc = this.videoEncoder;
      if (!enc) return;
      while (enc.encodeQueueSize > this.maxQueueSize) {
        if (this.encodeError) return;
        await new Promise((resolve) => rawSetTimeout2(resolve, 0));
      }
    }
    async save() {
      if (this.savedBlob) return this.savedBlob;
      if (!this.frames || !this.videoEncoder) return null;
      await this.videoEncoder.flush();
      if (this.audioEnabled && this.audioEncoder) {
        __privateMethod(this, _WebCodecsEncoder_instances, encodeAudio_fn).call(this);
        await this.audioEncoder.flush();
      }
      if (this.encodeError) throw this.encodeError;
      try {
        this.muxer.finalize();
      } catch (e) {
        throw new Error(
          `${this.container} muxing failed \u2014 this browser's WebCodecs likely didn't provide a decoder config for "${this.codec}". Try format "webm". (${e.message})`
        );
      }
      this.savedBlob = new Blob([this.target.buffer], { type: this.mimeType });
      return this.savedBlob;
    }
    async dispose() {
      for (const enc of [this.videoEncoder, this.audioEncoder]) {
        if (enc && enc.state !== "closed") {
          try {
            enc.close();
          } catch {
          }
        }
      }
      this.videoEncoder = null;
      this.audioEncoder = null;
      this.audioEnabled = false;
      this.muxer = null;
      this.target = null;
      this.configured = false;
      this.savedBlob = null;
      this.fitCanvas = null;
      this.fitCtx = null;
    }
    async stop() {
      await super.stop();
    }
  };
  _WebCodecsEncoder_instances = new WeakSet();
  bitrateFor_fn = function(width, height) {
    if (this.bitrate) return this.bitrate;
    const bpp = 0.05 + 0.15 * (this.params.quality / 100);
    return Math.round(width * height * this.params.framerate * bpp);
  };
  deliversConfig_fn = async function(config) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (v) => {
        if (settled) return;
        settled = true;
        try {
          enc.close();
        } catch {
        }
        resolve(v);
      };
      let enc;
      try {
        enc = new VideoEncoder({
          output: (chunk, meta) => finish(!!(meta && meta.decoderConfig)),
          error: () => finish(false)
        });
        enc.configure(config);
        const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(config.width, config.height) : Object.assign(document.createElement("canvas"), {
          width: config.width,
          height: config.height
        });
        c.getContext("2d").fillRect(0, 0, 2, 2);
        const frame = new VideoFrame(c, { timestamp: 0 });
        enc.encode(frame, { keyFrame: true });
        frame.close();
        enc.flush().then(() => finish(false)).catch(() => finish(false));
      } catch {
        finish(false);
      }
    });
  };
  configure_fn = async function(sourceWidth, sourceHeight) {
    const width = sourceWidth - sourceWidth % 2;
    const height = sourceHeight - sourceHeight % 2;
    this.codedWidth = width;
    this.codedHeight = height;
    this.frameIndex = 0;
    this.savedBlob = null;
    const bitrate = __privateMethod(this, _WebCodecsEncoder_instances, bitrateFor_fn).call(this, width, height);
    const families = this.explicitCodec ? [this.explicitCodec] : this.container === "mp4" ? MP4_FAMILIES : WEBM_FAMILIES;
    let config = null;
    let family = null;
    outer: for (const fam of families) {
      for (const codec of CANDIDATES[fam] || []) {
        const attempt = { codec, width, height, bitrate, framerate: this.params.framerate };
        if (this.container === "mp4") {
          if (codec.startsWith("avc")) attempt.avc = { format: "avc" };
          else if (codec.startsWith("hvc") || codec.startsWith("hev"))
            attempt.hevc = { format: "hevc" };
        }
        try {
          const support = await VideoEncoder.isConfigSupported(attempt);
          if (!support || !support.supported) continue;
          if (this.container === "mp4" && !await __privateMethod(this, _WebCodecsEncoder_instances, deliversConfig_fn).call(this, attempt)) {
            continue;
          }
          config = attempt;
          family = fam;
          break outer;
        } catch {
        }
      }
    }
    if (!config) {
      const hint = this.container === "mp4" ? ' Try format "webm".' : "";
      throw new Error(
        `No usable VideoEncoder config for ${this.container} (tried ${families.join(
          "/"
        )}) at ${width}x${height} in this browser.${hint}`
      );
    }
    this.codec = family;
    this.encoderConfig = config;
    this.audioEnabled = false;
    let audioConfig = null;
    let audioMuxerCodec = null;
    if (this.audio && typeof AudioEncoder !== "undefined") {
      for (const cand of AUDIO[this.container]) {
        const conf = {
          codec: cand.encoder,
          sampleRate: this.audio.sampleRate,
          numberOfChannels: this.audio.numberOfChannels,
          bitrate: this.audioBitrate
        };
        try {
          const sup = await AudioEncoder.isConfigSupported(conf);
          if (sup && sup.supported) {
            audioConfig = conf;
            audioMuxerCodec = cand.muxer;
            this.audioEnabled = true;
            break;
          }
        } catch {
        }
      }
      if (!this.audioEnabled) {
        console.warn("[WebCodecs] no supported audio encoder here; encoding video only.");
      }
    }
    const audioTrack = this.audioEnabled ? {
      codec: audioMuxerCodec,
      sampleRate: this.audio.sampleRate,
      numberOfChannels: this.audio.numberOfChannels
    } : void 0;
    if (this.container === "mp4") {
      this.target = new ArrayBufferTarget();
      this.muxer = new Muxer({
        target: this.target,
        video: { codec: MP4_CODEC[family], width, height },
        ...audioTrack ? { audio: audioTrack } : {},
        fastStart: "in-memory"
      });
    } else {
      this.target = new ArrayBufferTarget2();
      this.muxer = new Muxer2({
        target: this.target,
        video: { codec: WEBM_CODEC[family], width, height },
        ...audioTrack ? { audio: audioTrack } : {}
      });
    }
    this.videoEncoder = new VideoEncoder({
      output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        this.encodeError = e;
        console.error("[WebCodecs] encoder error:", e);
      }
    });
    this.videoEncoder.configure(config);
    if (this.audioEnabled) {
      this.audioEncoder = new AudioEncoder({
        output: (chunk, meta) => this.muxer.addAudioChunk(chunk, meta),
        error: (e) => {
          this.encodeError = e;
          console.error("[WebCodecs] audio encoder error:", e);
        }
      });
      this.audioEncoder.configure(audioConfig);
    }
    this.configured = true;
  };
  // Encode the audio buffer (trimmed to the captured video length) in one pass.
  encodeAudio_fn = function() {
    const buf = this.audio;
    const sr = buf.sampleRate;
    const ch = buf.numberOfChannels;
    const videoSeconds = this.frameIndex / this.params.framerate;
    const total = Math.min(buf.length, Math.ceil(videoSeconds * sr));
    const channels = [];
    for (let c = 0; c < ch; c++) channels.push(buf.getChannelData(c));
    const block = 4096;
    for (let off = 0; off < total; off += block) {
      const frames = Math.min(block, total - off);
      const planar = new Float32Array(frames * ch);
      for (let c = 0; c < ch; c++) {
        planar.set(channels[c].subarray(off, off + frames), c * frames);
      }
      const data = new AudioData({
        format: "f32-planar",
        sampleRate: sr,
        numberOfFrames: frames,
        numberOfChannels: ch,
        timestamp: Math.round(off / sr * 1e6),
        data: planar
      });
      this.audioEncoder.encode(data);
      data.close();
    }
  };
  fit_fn = function(canvas) {
    if (canvas.width === this.codedWidth && canvas.height === this.codedHeight) {
      return canvas;
    }
    if (!this.fitCanvas) {
      this.fitCanvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(this.codedWidth, this.codedHeight) : Object.assign(document.createElement("canvas"), {
        width: this.codedWidth,
        height: this.codedHeight
      });
      this.fitCtx = this.fitCanvas.getContext("2d");
    }
    this.fitCtx.clearRect(0, 0, this.codedWidth, this.codedHeight);
    this.fitCtx.drawImage(canvas, 0, 0);
    return this.fitCanvas;
  };
  var WebCodecsEncoder = _WebCodecsEncoder;

  // src/third_party/gifenc.mjs
  var X = { signature: "GIF", version: "89a", trailer: 59, extensionIntroducer: 33, applicationExtensionLabel: 255, graphicControlExtensionLabel: 249, imageSeparator: 44, signatureSize: 3, versionSize: 3, globalColorTableFlagMask: 128, colorResolutionMask: 112, sortFlagMask: 8, globalColorTableSizeMask: 7, applicationIdentifierSize: 8, applicationAuthCodeSize: 3, disposalMethodMask: 28, userInputFlagMask: 2, transparentColorFlagMask: 1, localColorTableFlagMask: 128, interlaceFlagMask: 64, idSortFlagMask: 32, localColorTableSizeMask: 7 };
  function F(t = 256) {
    let e = 0, s = new Uint8Array(t);
    return { get buffer() {
      return s.buffer;
    }, reset() {
      e = 0;
    }, bytesView() {
      return s.subarray(0, e);
    }, bytes() {
      return s.slice(0, e);
    }, writeByte(r) {
      n(e + 1), s[e] = r, e++;
    }, writeBytes(r, o = 0, i = r.length) {
      n(e + i);
      for (let c = 0; c < i; c++) s[e++] = r[c + o];
    }, writeBytesView(r, o = 0, i = r.byteLength) {
      n(e + i), s.set(r.subarray(o, o + i), e), e += i;
    } };
    function n(r) {
      var o = s.length;
      if (o >= r) return;
      var i = 1024 * 1024;
      r = Math.max(r, o * (o < i ? 2 : 1.125) >>> 0), o != 0 && (r = Math.max(r, 256));
      let c = s;
      s = new Uint8Array(r), e > 0 && s.set(c.subarray(0, e), 0);
    }
  }
  var O = 12;
  var J = 5003;
  var lt = [0, 1, 3, 7, 15, 31, 63, 127, 255, 511, 1023, 2047, 4095, 8191, 16383, 32767, 65535];
  function at(t, e, s, n, r = F(512), o = new Uint8Array(256), i = new Int32Array(J), c = new Int32Array(J)) {
    let x = i.length, a = Math.max(2, n);
    o.fill(0), c.fill(0), i.fill(-1);
    let l = 0, f = 0, g = a + 1, h = g, b = false, w = h, _ = (1 << w) - 1, u = 1 << g - 1, k = u + 1, B = u + 2, p = 0, A = s[0], z = 0;
    for (let y = x; y < 65536; y *= 2) ++z;
    z = 8 - z, r.writeByte(a), I(u);
    let d = s.length;
    for (let y = 1; y < d; y++) {
      t: {
        let m = s[y], v = (m << O) + A, M = m << z ^ A;
        if (i[M] === v) {
          A = c[M];
          break t;
        }
        let V = M === 0 ? 1 : x - M;
        for (; i[M] >= 0; ) if (M -= V, M < 0 && (M += x), i[M] === v) {
          A = c[M];
          break t;
        }
        I(A), A = m, B < 1 << O ? (c[M] = B++, i[M] = v) : (i.fill(-1), B = u + 2, b = true, I(u));
      }
    }
    return I(A), I(k), r.writeByte(0), r.bytesView();
    function I(y) {
      for (l &= lt[f], f > 0 ? l |= y << f : l = y, f += w; f >= 8; ) o[p++] = l & 255, p >= 254 && (r.writeByte(p), r.writeBytesView(o, 0, p), p = 0), l >>= 8, f -= 8;
      if ((B > _ || b) && (b ? (w = h, _ = (1 << w) - 1, b = false) : (++w, _ = w === O ? 1 << w : (1 << w) - 1)), y == k) {
        for (; f > 0; ) o[p++] = l & 255, p >= 254 && (r.writeByte(p), r.writeBytesView(o, 0, p), p = 0), l >>= 8, f -= 8;
        p > 0 && (r.writeByte(p), r.writeBytesView(o, 0, p), p = 0);
      }
    }
  }
  var $ = at;
  function D(t, e, s) {
    return t << 8 & 63488 | e << 2 & 992 | s >> 3;
  }
  function G(t, e, s, n) {
    return t >> 4 | e & 240 | (s & 240) << 4 | (n & 240) << 8;
  }
  function j(t, e, s) {
    return t >> 4 << 8 | e & 240 | s >> 4;
  }
  function R(t, e, s) {
    return t < e ? e : t > s ? s : t;
  }
  function T(t) {
    return t * t;
  }
  function tt(t, e, s) {
    var n = 0, r = 1e100;
    let o = t[e], i = o.cnt, c = o.ac, x = o.rc, a = o.gc, l = o.bc;
    for (var f = o.fw; f != 0; f = t[f].fw) {
      let h = t[f], b = h.cnt, w = i * b / (i + b);
      if (!(w >= r)) {
        var g = 0;
        s && (g += w * T(h.ac - c), g >= r) || (g += w * T(h.rc - x), !(g >= r) && (g += w * T(h.gc - a), !(g >= r) && (g += w * T(h.bc - l), !(g >= r) && (r = g, n = f))));
      }
    }
    o.err = r, o.nn = n;
  }
  function Q() {
    return { ac: 0, rc: 0, gc: 0, bc: 0, cnt: 0, nn: 0, fw: 0, bk: 0, tm: 0, mtm: 0, err: 0 };
  }
  function ut(t, e) {
    let s = e === "rgb444" ? 4096 : 65536, n = new Array(s), r = t.length;
    if (e === "rgba4444") for (let o = 0; o < r; ++o) {
      let i = t[o], c = i >> 24 & 255, x = i >> 16 & 255, a = i >> 8 & 255, l = i & 255, f = G(l, a, x, c), g = f in n ? n[f] : n[f] = Q();
      g.rc += l, g.gc += a, g.bc += x, g.ac += c, g.cnt++;
    }
    else if (e === "rgb444") for (let o = 0; o < r; ++o) {
      let i = t[o], c = i >> 16 & 255, x = i >> 8 & 255, a = i & 255, l = j(a, x, c), f = l in n ? n[l] : n[l] = Q();
      f.rc += a, f.gc += x, f.bc += c, f.cnt++;
    }
    else for (let o = 0; o < r; ++o) {
      let i = t[o], c = i >> 16 & 255, x = i >> 8 & 255, a = i & 255, l = D(a, x, c), f = l in n ? n[l] : n[l] = Q();
      f.rc += a, f.gc += x, f.bc += c, f.cnt++;
    }
    return n;
  }
  function H(t, e, s = {}) {
    let { format: n = "rgb565", clearAlpha: r = true, clearAlphaColor: o = 0, clearAlphaThreshold: i = 0, oneBitAlpha: c = false } = s;
    if (!t || !t.buffer) throw new Error("quantize() expected RGBA Uint8Array data");
    if (!(t instanceof Uint8Array) && !(t instanceof Uint8ClampedArray)) throw new Error("quantize() expected RGBA Uint8Array data");
    let x = new Uint32Array(t.buffer), a = s.useSqrt !== false, l = n === "rgba4444", f = ut(x, n), g = f.length, h = g - 1, b = new Uint32Array(g + 1);
    for (var w = 0, u = 0; u < g; ++u) {
      let C = f[u];
      if (C != null) {
        var _ = 1 / C.cnt;
        l && (C.ac *= _), C.rc *= _, C.gc *= _, C.bc *= _, f[w++] = C;
      }
    }
    T(e) / w < 0.022 && (a = false);
    for (var u = 0; u < w - 1; ++u) f[u].fw = u + 1, f[u + 1].bk = u, a && (f[u].cnt = Math.sqrt(f[u].cnt));
    a && (f[u].cnt = Math.sqrt(f[u].cnt));
    var k, B, p;
    for (u = 0; u < w; ++u) {
      tt(f, u, false);
      var A = f[u].err;
      for (B = ++b[0]; B > 1 && (p = B >> 1, !(f[k = b[p]].err <= A)); B = p) b[B] = k;
      b[B] = u;
    }
    var z = w - e;
    for (u = 0; u < z; ) {
      for (var d; ; ) {
        var I = b[1];
        if (d = f[I], d.tm >= d.mtm && f[d.nn].mtm <= d.tm) break;
        d.mtm == h ? I = b[1] = b[b[0]--] : (tt(f, I, false), d.tm = u);
        var A = f[I].err;
        for (B = 1; (p = B + B) <= b[0] && (p < b[0] && f[b[p]].err > f[b[p + 1]].err && p++, !(A <= f[k = b[p]].err)); B = p) b[B] = k;
        b[B] = I;
      }
      var y = f[d.nn], m = d.cnt, v = y.cnt, _ = 1 / (m + v);
      l && (d.ac = _ * (m * d.ac + v * y.ac)), d.rc = _ * (m * d.rc + v * y.rc), d.gc = _ * (m * d.gc + v * y.gc), d.bc = _ * (m * d.bc + v * y.bc), d.cnt += y.cnt, d.mtm = ++u, f[y.bk].fw = y.fw, f[y.fw].bk = y.bk, y.mtm = h;
    }
    let M = [];
    var V = 0;
    for (u = 0; ; ++V) {
      let L = R(Math.round(f[u].rc), 0, 255), C = R(Math.round(f[u].gc), 0, 255), Y = R(Math.round(f[u].bc), 0, 255), E = 255;
      if (l) {
        if (E = R(Math.round(f[u].ac), 0, 255), c) {
          let st = typeof c == "number" ? c : 127;
          E = E <= st ? 0 : 255;
        }
        r && E <= i && (L = C = Y = o, E = 0);
      }
      let K = l ? [L, C, Y, E] : [L, C, Y];
      if (xt(M, K) || M.push(K), (u = f[u].fw) == 0) break;
    }
    return M;
  }
  function xt(t, e) {
    for (let s = 0; s < t.length; s++) {
      let n = t[s], r = n[0] === e[0] && n[1] === e[1] && n[2] === e[2], o = n.length >= 4 && e.length >= 4 ? n[3] === e[3] : true;
      if (r && o) return true;
    }
    return false;
  }
  function nt(t, e, s = "rgb565") {
    if (!t || !t.buffer) throw new Error("quantize() expected RGBA Uint8Array data");
    if (!(t instanceof Uint8Array) && !(t instanceof Uint8ClampedArray)) throw new Error("quantize() expected RGBA Uint8Array data");
    if (e.length > 256) throw new Error("applyPalette() only works with 256 colors or less");
    let n = new Uint32Array(t.buffer), r = n.length, o = s === "rgb444" ? 4096 : 65536, i = new Uint8Array(r), c = new Array(o), x = s === "rgba4444";
    if (s === "rgba4444") for (let a = 0; a < r; a++) {
      let l = n[a], f = l >> 24 & 255, g = l >> 16 & 255, h = l >> 8 & 255, b = l & 255, w = G(b, h, g, f), _ = w in c ? c[w] : c[w] = gt(b, h, g, f, e);
      i[a] = _;
    }
    else {
      let a = s === "rgb444" ? j : D;
      for (let l = 0; l < r; l++) {
        let f = n[l], g = f >> 16 & 255, h = f >> 8 & 255, b = f & 255, w = a(b, h, g), _ = w in c ? c[w] : c[w] = bt(b, h, g, e);
        i[l] = _;
      }
    }
    return i;
  }
  function gt(t, e, s, n, r) {
    let o = 0, i = 1e100;
    for (let c = 0; c < r.length; c++) {
      let x = r[c], a = x[3], l = q(a - n);
      if (l > i) continue;
      let f = x[0];
      if (l += q(f - t), l > i) continue;
      let g = x[1];
      if (l += q(g - e), l > i) continue;
      let h = x[2];
      l += q(h - s), !(l > i) && (i = l, o = c);
    }
    return o;
  }
  function bt(t, e, s, n) {
    let r = 0, o = 1e100;
    for (let i = 0; i < n.length; i++) {
      let c = n[i], x = c[0], a = q(x - t);
      if (a > o) continue;
      let l = c[1];
      if (a += q(l - e), a > o) continue;
      let f = c[2];
      a += q(f - s), !(a > o) && (o = a, r = i);
    }
    return r;
  }
  function q(t) {
    return t * t;
  }
  function ct(t = {}) {
    let { initialCapacity: e = 4096, auto: s = true } = t, n = F(e), r = 5003, o = new Uint8Array(256), i = new Int32Array(r), c = new Int32Array(r), x = false;
    return { reset() {
      n.reset(), x = false;
    }, finish() {
      n.writeByte(X.trailer);
    }, bytes() {
      return n.bytes();
    }, bytesView() {
      return n.bytesView();
    }, get buffer() {
      return n.buffer;
    }, get stream() {
      return n;
    }, writeHeader: a, writeFrame(l, f, g, h = {}) {
      let { transparent: b = false, transparentIndex: w = 0, delay: _ = 0, palette: u = null, repeat: k = 0, colorDepth: B = 8, dispose: p = -1 } = h, A = false;
      if (s ? x || (A = true, a(), x = true) : A = Boolean(h.first), f = Math.max(0, Math.floor(f)), g = Math.max(0, Math.floor(g)), A) {
        if (!u) throw new Error("First frame must include a { palette } option");
        pt(n, f, g, u, B), it(n, u), k >= 0 && dt(n, k);
      }
      let z = Math.round(_ / 10);
      wt(n, p, z, b, w);
      let d = Boolean(u) && !A;
      ht(n, f, g, d ? u : null), d && it(n, u), yt(n, l, f, g, B, o, i, c);
    } };
    function a() {
      ft(n, "GIF89a");
    }
  }
  function wt(t, e, s, n, r) {
    t.writeByte(33), t.writeByte(249), t.writeByte(4), r < 0 && (r = 0, n = false);
    var o, i;
    n ? (o = 1, i = 2) : (o = 0, i = 0), e >= 0 && (i = e & 7), i <<= 2;
    let c = 0;
    t.writeByte(0 | i | c | o), S(t, s), t.writeByte(r || 0), t.writeByte(0);
  }
  function pt(t, e, s, n, r = 8) {
    let o = 1, i = 0, c = Z(n.length) - 1, x = o << 7 | r - 1 << 4 | i << 3 | c, a = 0, l = 0;
    S(t, e), S(t, s), t.writeBytes([x, a, l]);
  }
  function dt(t, e) {
    t.writeByte(33), t.writeByte(255), t.writeByte(11), ft(t, "NETSCAPE2.0"), t.writeByte(3), t.writeByte(1), S(t, e), t.writeByte(0);
  }
  function it(t, e) {
    let s = 1 << Z(e.length);
    for (let n = 0; n < s; n++) {
      let r = [0, 0, 0];
      n < e.length && (r = e[n]), t.writeByte(r[0]), t.writeByte(r[1]), t.writeByte(r[2]);
    }
  }
  function ht(t, e, s, n) {
    if (t.writeByte(44), S(t, 0), S(t, 0), S(t, e), S(t, s), n) {
      let r = 0, o = 0, i = Z(n.length) - 1;
      t.writeByte(128 | r | o | 0 | i);
    } else t.writeByte(0);
  }
  function yt(t, e, s, n, r = 8, o, i, c) {
    $(s, n, e, r, t, o, i, c);
  }
  function S(t, e) {
    t.writeByte(e & 255), t.writeByte(e >> 8 & 255);
  }
  function ft(t, e) {
    for (var s = 0; s < e.length; s++) t.writeByte(e.charCodeAt(s));
  }
  function Z(t) {
    return Math.max(Math.ceil(Math.log2(t)), 1);
  }

  // src/encoders/GIFEncoder.js
  var _GIFEncoder_instances, readback_fn;
  var GIFEncoder = class extends FrameEncoder {
    constructor(params) {
      super(params);
      __privateAdd(this, _GIFEncoder_instances);
      this.extension = "gif";
      this.mimeType = "image/gif";
      this.maxColors = Math.min(256, Math.max(2, params.gifColors ?? 256));
      this.delay = Math.max(1, Math.round(100 / params.framerate));
      this.gif = null;
      this.canvas = null;
      this.ctx = null;
      this.savedBlob = null;
    }
    async start() {
      await super.start();
      this.gif = ct();
      this.savedBlob = null;
    }
    async add(canvas) {
      const { data, width, height } = __privateMethod(this, _GIFEncoder_instances, readback_fn).call(this, canvas);
      const palette = H(data, this.maxColors);
      const index = nt(data, palette);
      this.gif.writeFrame(index, width, height, { palette, delay: this.delay });
      await super.add();
    }
    async save() {
      if (this.savedBlob) return this.savedBlob;
      if (!this.frames) return null;
      this.gif.finish();
      this.savedBlob = new Blob([this.gif.bytes()], { type: this.mimeType });
      return this.savedBlob;
    }
    async dispose() {
      this.gif = null;
      this.savedBlob = null;
    }
  };
  _GIFEncoder_instances = new WeakSet();
  readback_fn = function(canvas) {
    const { width, height } = canvas;
    if (!this.ctx || this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : Object.assign(document.createElement("canvas"), { width, height });
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    }
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.drawImage(canvas, 0, 0);
    return this.ctx.getImageData(0, 0, width, height);
  };

  // src/FrameWrap.js
  var encoders = {
    mp4: WebCodecsEncoder,
    webm: WebCodecsEncoder,
    "webm-legacy": WebMEncoder,
    gif: GIFEncoder,
    png: PNGEncoder,
    jpg: JPGEncoder,
    webp: WebPEncoder
  };
  function resolveEncoder(format) {
    const Encoder = encoders[format];
    if (Encoder === WebCodecsEncoder && !WebCodecsEncoder.isSupported()) {
      if (format === "webm") return WebMEncoder;
      throw new Error(
        `Format "${format}" requires WebCodecs (VideoEncoder), which is not available in this browser. Try "webm" (falls back automatically).`
      );
    }
    return Encoder;
  }
  var defaultParams = {
    format: "mp4",
    framerate: 60,
    quality: 90,
    name: void 0,
    // falls back to a guid in the encoder
    encoder: void 0,
    // bring-your-own: an encoder class or instance (overrides format)
    gifColors: 256,
    // GIF palette size (2–256)
    codec: void 0,
    // avc/vp9/av1/vp8; defaults per container
    bitrate: 0,
    // bits/sec; 0 = derive from resolution & quality
    audio: null,
    // AudioBuffer to encode + mux as an audio track (mp4/webm)
    audioBitrate: 128e3,
    // audio bits/sec
    maxQueueSize: 8,
    // WebCodecs encoder queue high-water mark (backpressure)
    motionBlurFrames: 1,
    // samples averaged per output frame; 1 = no blur
    motionBlur: "auto",
    // backend: "auto" | "gpu" | "cpu"
    timeLimit: 0,
    // seconds; 0 = unlimited
    frameLimit: 0,
    // output frames; 0 = unlimited
    autoSaveTime: 0,
    // seconds; >0 downloads parts periodically
    verbose: false,
    display: false
  };
  var _FrameWrap_instances, log_fn, reset_fn, process_fn, afterFrame_fn, createDisplay_fn, updateDisplay_fn;
  var _FrameWrap = class _FrameWrap {
    constructor(params = {}) {
      __privateAdd(this, _FrameWrap_instances);
      this.params = { ...defaultParams, ...params };
      const byo = this.params.encoder;
      if (byo) {
        this.encoder = typeof byo === "function" ? new byo(this.params) : byo;
      } else {
        if (!encoders[this.params.format]) {
          throw new Error(
            `Unknown format "${this.params.format}". Valid formats: ${Object.keys(
              encoders
            ).join(", ")}`
          );
        }
        this.encoder = new (resolveEncoder(this.params.format))(this.params);
      }
      this.subframes = Math.max(1, Math.round(this.params.motionBlurFrames) || 1);
      this.frameStep = 1e3 / this.params.framerate;
      this.frameCount = 0;
      this.intermediateFrameCount = 0;
      this.capturing = false;
      this.saved = false;
      this.motionBlur = null;
      this.handlers = {};
      if (typeof this.encoder.on === "function") {
        this.encoder.on("progress", (p) => this.emit("progress", p));
      }
      __privateMethod(this, _FrameWrap_instances, createDisplay_fn).call(this);
    }
    /**
     * Register a custom encoder under a `format` name (see BatchEncoder /
     * FrameEncoder for the contract).
     */
    static registerEncoder(name, EncoderClass) {
      encoders[name] = EncoderClass;
      return _FrameWrap;
    }
    /** The currently registered format names. */
    static get formats() {
      return Object.keys(encoders);
    }
    on(event, handler) {
      this.handlers[event] = handler;
      return this;
    }
    emit(event, ...args) {
      const handler = this.handlers[event];
      if (handler) handler(...args);
    }
    async start() {
      __privateMethod(this, _FrameWrap_instances, reset_fn).call(this);
      await this.encoder.start();
      this.capturing = true;
      __privateMethod(this, _FrameWrap_instances, log_fn).call(this, "start");
      this.emit("start");
    }
    /**
     * Encode one already-drawn frame. With motion blur, several sub-frames are
     * averaged before an output frame is emitted. No timing side effects.
     */
    async capture(canvas) {
      if (!this.capturing) return;
      try {
        await __privateMethod(this, _FrameWrap_instances, process_fn).call(this, canvas);
      } catch (e) {
        console.error("[FrameWrap] capture error:", e);
        this.emit("error", e);
        await this.stop();
      }
    }
    async stop() {
      if (!this.capturing) return;
      this.capturing = false;
      await this.encoder.stop();
      __privateMethod(this, _FrameWrap_instances, log_fn).call(this, "stop");
      this.emit("stop");
    }
    /**
     * Finalize and either download the result or hand the Blob to `callback`.
     * Safe to call while still capturing to grab everything so far.
     * @returns {Promise<Blob|null>}
     */
    async save(callback) {
      const blob = await this.encoder.save();
      if (!blob) return null;
      this.saved = true;
      if (callback) {
        callback(blob);
      } else if (typeof document !== "undefined") {
        download(blob, this.encoder.name, this.encoder.mimeType);
      }
      this.emit("save", blob);
      return blob;
    }
    async dispose() {
      if (this.capturing) await this.stop();
      this.motionBlur?.dispose?.();
      this.motionBlur = null;
      await this.encoder?.dispose?.();
      if (this.display) {
        this.display.remove?.();
        this.display = null;
      }
    }
  };
  _FrameWrap_instances = new WeakSet();
  log_fn = function(...args) {
    if (this.params.verbose) console.log("[FrameWrap]", ...args);
  };
  reset_fn = function() {
    this.frameCount = 0;
    this.intermediateFrameCount = 0;
    this.saved = false;
    this.motionBlur?.reset();
  };
  process_fn = async function(canvas) {
    if (this.subframes > 1) {
      this.motionBlur || (this.motionBlur = createMotionBlur(
        canvas,
        this.subframes,
        this.params.motionBlur
      ));
      this.motionBlur.add(canvas);
      this.intermediateFrameCount++;
      if (this.intermediateFrameCount >= this.subframes) {
        const blended = this.motionBlur.resolve();
        await this.encoder.add(blended);
        this.motionBlur.reset();
        this.intermediateFrameCount = 0;
        this.frameCount++;
        __privateMethod(this, _FrameWrap_instances, updateDisplay_fn).call(this);
        await __privateMethod(this, _FrameWrap_instances, afterFrame_fn).call(this);
        return;
      }
    } else {
      await this.encoder.add(canvas);
      this.frameCount++;
      await __privateMethod(this, _FrameWrap_instances, afterFrame_fn).call(this);
    }
    __privateMethod(this, _FrameWrap_instances, updateDisplay_fn).call(this);
  };
  afterFrame_fn = async function() {
    this.emit("frame", this.frameCount);
    const { frameLimit, timeLimit, framerate } = this.params;
    const seconds = this.frameCount / framerate;
    if (frameLimit && this.frameCount >= frameLimit || timeLimit && seconds >= timeLimit) {
      __privateMethod(this, _FrameWrap_instances, log_fn).call(this, "limit reached, finalizing");
      await this.stop();
      await this.save();
    }
  };
  createDisplay_fn = function() {
    if (typeof document === "undefined" || !this.params.display) return;
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "absolute",
      left: "0",
      top: "0",
      backgroundColor: "black",
      fontFamily: "monospace",
      fontSize: "11px",
      padding: "5px",
      color: "red",
      zIndex: "100000"
    });
    document.body.appendChild(el);
    this.display = el;
  };
  updateDisplay_fn = function() {
    if (!this.display) return;
    const seconds = this.frameCount / this.params.framerate;
    const d = /* @__PURE__ */ new Date(null);
    d.setSeconds(seconds);
    const clock = d.toISOString().substr(11, 8);
    const inter = this.subframes > 1 ? ` (${this.intermediateFrameCount} inter)` : "";
    this.display.textContent = `CCapture ${this.params.format} | ${this.frameCount} frames${inter} | ${clock}`;
  };
  var FrameWrap = _FrameWrap;

  // src/TimeWarp.js
  var target = globalThis;
  var originals = {
    requestAnimationFrame: target.requestAnimationFrame,
    cancelAnimationFrame: target.cancelAnimationFrame,
    setTimeout: target.setTimeout,
    clearTimeout: target.clearTimeout,
    setInterval: target.setInterval,
    clearInterval: target.clearInterval,
    performanceNow: target.performance ? target.performance.now : void 0,
    dateNow: Date.now,
    dateGetTime: Date.prototype.getTime,
    dateValueOf: Date.prototype.valueOf
  };
  var nativeNow = originals.performanceNow ? originals.performanceNow.bind(target.performance) : originals.dateNow.bind(Date);
  var nativeDateNow = originals.dateNow.bind(Date);
  var mediaDescriptor = typeof HTMLMediaElement !== "undefined" ? Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    "currentTime"
  ) : void 0;
  var _enabled, _nextId, _timeouts, _intervals, _rafCallbacks, _media, _origPlay, _TimeWarp_instances, log_fn2, install_fn, installMedia_fn, restore_fn, invoke_fn, onError_fn, updateMedia_fn, syncMedia_fn, seek_fn, dispatch_fn;
  var TimeWarp = class {
    constructor({
      framerate = 60,
      startTime = 0,
      hookDate = true,
      hookValueOf = false,
      hookMedia = true,
      verbose = false
    } = {}) {
      __privateAdd(this, _TimeWarp_instances);
      __privateAdd(this, _enabled, false);
      __privateAdd(this, _nextId, 1);
      __privateAdd(this, _timeouts, []);
      __privateAdd(this, _intervals, []);
      __privateAdd(this, _rafCallbacks, []);
      __privateAdd(this, _media, []);
      __privateAdd(this, _origPlay, null);
      this.framerate = framerate;
      this.startTime = startTime;
      this.hookDate = hookDate;
      this.hookValueOf = hookValueOf;
      this.hookMedia = hookMedia;
      this.verbose = verbose;
      this.perfStart = 0;
      this.dateStart = 0;
      this.frameTime = 0;
    }
    get enabled() {
      return __privateGet(this, _enabled);
    }
    get frameStep() {
      return 1e3 / this.framerate;
    }
    /** Virtual performance.now() value. */
    get time() {
      return this.perfStart + this.frameTime;
    }
    start() {
      this.perfStart = nativeNow();
      this.dateStart = nativeDateNow();
      this.frameTime = this.startTime * 1e3;
      __privateGet(this, _timeouts).length = 0;
      __privateGet(this, _intervals).length = 0;
      __privateGet(this, _rafCallbacks).length = 0;
      __privateGet(this, _media).length = 0;
      this.enable();
      __privateMethod(this, _TimeWarp_instances, log_fn2).call(this, "start", { perfStart: this.perfStart, frameTime: this.frameTime });
    }
    stop() {
      this.disable();
      __privateMethod(this, _TimeWarp_instances, log_fn2).call(this, "stop");
    }
    enable() {
      if (__privateGet(this, _enabled)) return;
      __privateSet(this, _enabled, true);
      __privateMethod(this, _TimeWarp_instances, install_fn).call(this);
    }
    disable() {
      if (!__privateGet(this, _enabled)) return;
      __privateSet(this, _enabled, false);
      __privateMethod(this, _TimeWarp_instances, restore_fn).call(this);
    }
    /**
     * Register a media element to be frame-stepped. Called automatically when code
     * reads/writes `currentTime`, but call it explicitly for a `<video>` you only
     * ever draw with `drawImage` (which never touches `currentTime`).
     */
    addMedia(element) {
      if (!this.hookMedia) return;
      if (!element || __privateGet(this, _media).includes(element)) return;
      element.__ccHooked = true;
      element.__ccHookedTime = mediaDescriptor ? mediaDescriptor.get.call(element) || 0 : 0;
      if (typeof element.pause === "function") element.pause();
      __privateGet(this, _media).push(element);
    }
    /**
     * Advance the virtual clock by `dt` ms (default: one frame) and dispatch all
     * callbacks that come due.
     *
     * Dispatch is synchronous and fire-and-forget: callbacks run in order
     * (timeouts → intervals → rAF) and their return values are NOT awaited — this
     * is what lets `capture()` flush the next rAF without an O(N) promise chain.
     * Media scrubs are issued but not awaited; use `stepAsync` for frame-accurate
     * video/audio.
     */
    step(dt2 = this.frameStep) {
      if (!__privateGet(this, _enabled)) return;
      this.frameTime += dt2;
      __privateMethod(this, _TimeWarp_instances, updateMedia_fn).call(this);
      __privateMethod(this, _TimeWarp_instances, dispatch_fn).call(this);
    }
    /**
     * Like `step`, but awaits every media element finishing its seek before
     * dispatching the next frame — so a `<video>` drawn to the canvas shows the
     * exact frame for this moment. FrameWrap uses this to drive capture.
     */
    async stepAsync(dt2 = this.frameStep) {
      if (!__privateGet(this, _enabled)) return;
      this.frameTime += dt2;
      await __privateMethod(this, _TimeWarp_instances, syncMedia_fn).call(this);
      __privateMethod(this, _TimeWarp_instances, dispatch_fn).call(this);
    }
  };
  _enabled = new WeakMap();
  _nextId = new WeakMap();
  _timeouts = new WeakMap();
  _intervals = new WeakMap();
  _rafCallbacks = new WeakMap();
  _media = new WeakMap();
  _origPlay = new WeakMap();
  _TimeWarp_instances = new WeakSet();
  log_fn2 = function(...args) {
    if (this.verbose) console.log("[TimeWarp]", ...args);
  };
  install_fn = function() {
    target.requestAnimationFrame = (callback) => {
      const id = __privateWrapper(this, _nextId)._++;
      __privateGet(this, _rafCallbacks).push({ id, callback });
      return id;
    };
    target.cancelAnimationFrame = (id) => {
      __privateSet(this, _rafCallbacks, __privateGet(this, _rafCallbacks).filter((c) => c.id !== id));
    };
    target.setTimeout = (callback, time = 0, ...args) => {
      const id = __privateWrapper(this, _nextId)._++;
      __privateGet(this, _timeouts).push({
        id,
        callback: args.length ? () => callback(...args) : callback,
        time,
        triggerTime: this.frameTime + time
      });
      return id;
    };
    target.clearTimeout = (id) => {
      __privateSet(this, _timeouts, __privateGet(this, _timeouts).filter((t) => t.id !== id));
    };
    target.setInterval = (callback, time = 0, ...args) => {
      const id = __privateWrapper(this, _nextId)._++;
      __privateGet(this, _intervals).push({
        id,
        callback: args.length ? () => callback(...args) : callback,
        time,
        triggerTime: this.frameTime + time
      });
      return id;
    };
    target.clearInterval = (id) => {
      __privateSet(this, _intervals, __privateGet(this, _intervals).filter((t) => t.id !== id));
    };
    if (target.performance) {
      Object.defineProperty(target.performance, "now", {
        configurable: true,
        writable: true,
        value: () => this.time
      });
    }
    if (this.hookDate) {
      const tw = this;
      const virtual = function() {
        return tw.dateStart + tw.frameTime;
      };
      Date.now = () => tw.dateStart + tw.frameTime;
      Date.prototype.getTime = virtual;
      if (this.hookValueOf) {
        Date.prototype.valueOf = virtual;
      }
    }
    if (this.hookMedia && mediaDescriptor) __privateMethod(this, _TimeWarp_instances, installMedia_fn).call(this);
    __privateMethod(this, _TimeWarp_instances, log_fn2).call(this, "hooks installed");
  };
  installMedia_fn = function() {
    const tw = this;
    Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
      configurable: true,
      get() {
        if (!this.__ccHooked) tw.addMedia(this);
        return this.__ccHookedTime;
      },
      set(value) {
        if (!this.__ccHooked) tw.addMedia(this);
        this.__ccHookedTime = value;
        mediaDescriptor.set.call(this, value);
      }
    });
    __privateSet(this, _origPlay, HTMLMediaElement.prototype.play);
    HTMLMediaElement.prototype.play = function() {
      return Promise.resolve();
    };
  };
  restore_fn = function() {
    target.requestAnimationFrame = originals.requestAnimationFrame;
    target.cancelAnimationFrame = originals.cancelAnimationFrame;
    target.setTimeout = originals.setTimeout;
    target.clearTimeout = originals.clearTimeout;
    target.setInterval = originals.setInterval;
    target.clearInterval = originals.clearInterval;
    if (target.performance && originals.performanceNow) {
      Object.defineProperty(target.performance, "now", {
        configurable: true,
        writable: true,
        value: originals.performanceNow
      });
    }
    if (this.hookDate) {
      Date.now = originals.dateNow;
      Date.prototype.getTime = originals.dateGetTime;
      if (this.hookValueOf) {
        Date.prototype.valueOf = originals.dateValueOf;
      }
    }
    if (this.hookMedia && mediaDescriptor) {
      Object.defineProperty(
        HTMLMediaElement.prototype,
        "currentTime",
        mediaDescriptor
      );
    }
    if (__privateGet(this, _origPlay)) {
      HTMLMediaElement.prototype.play = __privateGet(this, _origPlay);
      __privateSet(this, _origPlay, null);
    }
    for (const c of __privateGet(this, _rafCallbacks)) {
      if (originals.requestAnimationFrame) {
        originals.requestAnimationFrame.call(target, c.callback);
      }
    }
    __privateSet(this, _rafCallbacks, []);
    for (const t of __privateGet(this, _timeouts)) {
      const delay = Math.max(0, t.triggerTime - this.frameTime);
      originals.setTimeout.call(target, t.callback, delay);
    }
    __privateSet(this, _timeouts, []);
    for (const iv of __privateGet(this, _intervals)) {
      originals.setInterval.call(target, iv.callback, iv.time);
    }
    __privateSet(this, _intervals, []);
    __privateMethod(this, _TimeWarp_instances, log_fn2).call(this, "hooks restored");
  };
  invoke_fn = function(fn, arg) {
    try {
      return Promise.resolve(fn(arg)).catch((e) => __privateMethod(this, _TimeWarp_instances, onError_fn).call(this, e));
    } catch (e) {
      __privateMethod(this, _TimeWarp_instances, onError_fn).call(this, e);
      return Promise.resolve();
    }
  };
  onError_fn = function(e) {
    console.error("[TimeWarp] callback error:", e);
  };
  /** Fire-and-forget: set virtual currentTime and scrub, without awaiting seeks. */
  updateMedia_fn = function() {
    const seconds = this.frameTime / 1e3;
    for (const m of __privateGet(this, _media)) {
      m.__ccHookedTime = seconds;
      if (mediaDescriptor) {
        try {
          mediaDescriptor.set.call(m, seconds);
        } catch {
        }
      }
    }
  };
  syncMedia_fn = async function() {
    if (!__privateGet(this, _media).length) return;
    const seconds = this.frameTime / 1e3;
    const waits = [];
    for (const m of __privateGet(this, _media)) {
      m.__ccHookedTime = seconds;
      if (!mediaDescriptor) continue;
      let target2 = seconds;
      const dur = m.duration;
      if (typeof dur === "number" && isFinite(dur) && dur > 0) {
        target2 = Math.min(seconds, dur);
      }
      let current;
      try {
        current = mediaDescriptor.get.call(m);
      } catch {
        continue;
      }
      if (Math.abs(current - target2) < 1e-4) continue;
      waits.push(__privateMethod(this, _TimeWarp_instances, seek_fn).call(this, m, target2));
    }
    if (waits.length) await Promise.all(waits);
  };
  seek_fn = function(media, time) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        media.removeEventListener("seeked", finish);
        resolve();
      };
      media.addEventListener("seeked", finish, { once: true });
      try {
        mediaDescriptor.set.call(media, time);
      } catch {
        finish();
        return;
      }
      originals.setTimeout.call(target, finish, 2e3);
    });
  };
  dispatch_fn = function() {
    const now = this.frameTime;
    const dueTimeouts = [];
    __privateSet(this, _timeouts, __privateGet(this, _timeouts).filter((t) => {
      if (now >= t.triggerTime) {
        dueTimeouts.push(t);
        return false;
      }
      return true;
    }));
    dueTimeouts.sort((a, b) => a.triggerTime - b.triggerTime);
    for (const t of dueTimeouts) __privateMethod(this, _TimeWarp_instances, invoke_fn).call(this, t.callback);
    for (const iv of __privateGet(this, _intervals)) {
      if (now < iv.triggerTime) continue;
      if (iv.time <= 0) {
        __privateMethod(this, _TimeWarp_instances, invoke_fn).call(this, iv.callback);
        iv.triggerTime = now + this.frameStep;
        continue;
      }
      let guard = 0;
      while (now >= iv.triggerTime && guard++ < 1e4) {
        __privateMethod(this, _TimeWarp_instances, invoke_fn).call(this, iv.callback);
        iv.triggerTime += iv.time;
      }
    }
    const raf = __privateGet(this, _rafCallbacks);
    __privateSet(this, _rafCallbacks, []);
    for (const c of raf) __privateMethod(this, _TimeWarp_instances, invoke_fn).call(this, c.callback, this.time);
  };

  // src/CCapture.js
  var _CCapture_instances, dt_fn, tick_fn;
  var _CCapture = class _CCapture {
    constructor(params = {}) {
      __privateAdd(this, _CCapture_instances);
      this.framewrap = new FrameWrap(params);
      this.params = this.framewrap.params;
      this.timewarp = this.params.timewarp || new TimeWarp({
        framerate: this.params.framerate,
        startTime: this.params.startTime,
        hookDate: this.params.hookDate,
        hookValueOf: this.params.hookValueOf,
        hookMedia: this.params.hookMedia,
        verbose: this.params.verbose
      });
      this.manual = false;
      this.handlers = {};
      for (const ev of ["start", "frame", "progress", "save", "error"]) {
        this.framewrap.on(ev, (...args) => this.emit(ev, ...args));
      }
      this.framewrap.on("stop", () => {
        this.timewarp.stop();
        this.emit("stop");
      });
    }
    /** Register a custom encoder format (delegates to FrameWrap). */
    static registerEncoder(name, EncoderClass) {
      FrameWrap.registerEncoder(name, EncoderClass);
      return _CCapture;
    }
    /** Registered format names. */
    static get formats() {
      return FrameWrap.formats;
    }
    on(event, handler) {
      this.handlers[event] = handler;
      return this;
    }
    emit(event, ...args) {
      const handler = this.handlers[event];
      if (handler) handler(...args);
    }
    get capturing() {
      return this.framewrap.capturing;
    }
    get frameCount() {
      return this.framewrap.frameCount;
    }
    get encoder() {
      return this.framewrap.encoder;
    }
    get motionBlur() {
      return this.framewrap.motionBlur;
    }
    async start() {
      this.timewarp.start();
      if (this.params.media) {
        for (const el of [].concat(this.params.media)) this.timewarp.addMedia(el);
      }
      await this.framewrap.start();
    }
    /** Capture the just-drawn frame; auto-drives the loop (see class docs). */
    async capture(canvas) {
      if (!this.framewrap.capturing) return;
      await this.framewrap.capture(canvas);
      if (!this.manual && this.framewrap.capturing) {
        try {
          await __privateMethod(this, _CCapture_instances, tick_fn).call(this);
        } catch (e) {
          this.emit("error", e);
          await this.stop();
        }
      }
    }
    /** Advance the virtual clock by one sub-frame (synchronous; no media await). */
    step() {
      this.timewarp.step(__privateMethod(this, _CCapture_instances, dt_fn).call(this));
    }
    /**
     * Headless convenience for when you DON'T have an existing animation loop:
     * CCapture owns a flat loop, calling your `render` once per sub-frame. Needs a
     * `frameLimit`/`timeLimit`.
     */
    async record(canvas, render) {
      if (!this.params.frameLimit && !this.params.timeLimit) {
        throw new Error(
          "record() needs a frameLimit or timeLimit so the loop can terminate; use start()/capture() in your own loop for open-ended capture."
        );
      }
      this.manual = true;
      try {
        await this.start();
        while (this.framewrap.capturing) {
          await render(this.framewrap.frameCount);
          await this.capture(canvas);
          await this.timewarp.stepAsync(__privateMethod(this, _CCapture_instances, dt_fn).call(this));
          await nextTask();
        }
      } finally {
        this.manual = false;
      }
      return this.framewrap.saved;
    }
    async stop() {
      await this.framewrap.stop();
      this.timewarp.stop();
    }
    async save(callback) {
      return this.framewrap.save(callback);
    }
    async dispose() {
      await this.framewrap.dispose();
      this.timewarp.stop();
    }
  };
  _CCapture_instances = new WeakSet();
  dt_fn = function() {
    return this.framewrap.frameStep / this.framewrap.subframes;
  };
  tick_fn = async function() {
    const enc = this.framewrap.encoder;
    if (typeof enc.backpressure === "function") await enc.backpressure();
    await nextTask();
    if (this.framewrap.capturing) await this.timewarp.stepAsync(__privateMethod(this, _CCapture_instances, dt_fn).call(this));
  };
  var CCapture = _CCapture;

  // src/AudioTimeline.js
  var OfflineCtx = typeof OfflineAudioContext !== "undefined" ? OfflineAudioContext : typeof webkitOfflineAudioContext !== "undefined" ? webkitOfflineAudioContext : null;
  async function decodeToBuffer({ buffer, url: url2, arrayBuffer }) {
    if (buffer) return buffer;
    if (url2) arrayBuffer = await (await fetch(url2)).arrayBuffer();
    if (!arrayBuffer) {
      throw new Error("renderAudioFrames needs one of: buffer, url, arrayBuffer.");
    }
    const tmp = new OfflineCtx(1, 1, 44100);
    return tmp.decodeAudioData(arrayBuffer.slice(0));
  }
  async function renderAudioFrames(opts = {}) {
    if (!OfflineCtx) throw new Error("OfflineAudioContext is not available.");
    const {
      framerate = 60,
      startTime = 0,
      fftSize = 2048,
      smoothing = 0.8
    } = opts;
    const buffer = await decodeToBuffer(opts);
    const sampleRate = buffer.sampleRate;
    const duration = buffer.duration;
    const total = opts.frames ?? Math.max(0, Math.floor((duration - startTime) * framerate));
    if (sampleRate / framerate < 128) {
      throw new Error(
        `framerate ${framerate} is too high for ${sampleRate}Hz audio analysis (frames must be \u2265128 samples apart).`
      );
    }
    const length = Math.ceil((startTime + total / framerate) * sampleRate) + fftSize;
    const ctx = new OfflineCtx(buffer.numberOfChannels || 1, length, sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = smoothing;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    source.start(0);
    const frames = new Array(total);
    const emptyFreq = () => new Uint8Array(analyser.frequencyBinCount);
    const emptyWave = () => new Uint8Array(analyser.fftSize);
    for (let i = 0; i < total; i++) {
      const time = startTime + i / framerate;
      if (time >= duration) {
        frames[i] = { time, frequency: emptyFreq(), waveform: emptyWave() };
        continue;
      }
      ctx.suspend(time).then(() => {
        const frequency = emptyFreq();
        analyser.getByteFrequencyData(frequency);
        const waveform = emptyWave();
        analyser.getByteTimeDomainData(waveform);
        frames[i] = { time, frequency, waveform };
        ctx.resume();
      });
    }
    await ctx.startRendering();
    return frames;
  }

  // src/encoders/BatchEncoder.js
  var _BatchEncoder_instances, ctx_fn;
  var BatchEncoder = class extends FrameEncoder {
    constructor(params) {
      super(params);
      __privateAdd(this, _BatchEncoder_instances);
      this.bufferMode = params.bufferMode || "webp";
      this.bufferQuality = params.bufferQuality ?? 0.92;
      this.buffer = [];
      this.width = 0;
      this.height = 0;
      this._grabCanvas = null;
      this._grabCtx = null;
      this.savedBlob = null;
    }
    async start() {
      await super.start();
      this.buffer = [];
      this.savedBlob = null;
    }
    /** Turn a captured canvas into a compact stored token. Override to customize. */
    async _store(canvas) {
      if (this.bufferMode === "raw") {
        const ctx = __privateMethod(this, _BatchEncoder_instances, ctx_fn).call(this, canvas.width, canvas.height);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(canvas, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
      const type = this.bufferMode === "png" ? "image/png" : "image/webp";
      const blob = await asyncCanvasToBlob(canvas, type, this.bufferQuality);
      if (!blob) {
        throw new Error(
          `BatchEncoder: canvas.toBlob("${type}") returned null \u2014 this browser may not support that buffer format. Try { bufferMode: "png" } or "raw".`
        );
      }
      return { blob, width: canvas.width, height: canvas.height };
    }
    /** Decode a stored token back to ImageData. Override to match `_store`. */
    async _restore(token) {
      const isImageData = typeof ImageData !== "undefined" ? token instanceof ImageData : token && token.data && typeof token.width === "number";
      if (isImageData) return token;
      const { blob, width, height } = token;
      if (!width || !height) {
        throw new Error("BatchEncoder: stored frame has zero dimensions.");
      }
      const bmp = await createImageBitmap(blob);
      const ctx = __privateMethod(this, _BatchEncoder_instances, ctx_fn).call(this, width, height);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(bmp, 0, 0, width, height);
      bmp.close?.();
      return ctx.getImageData(0, 0, width, height);
    }
    async add(canvas) {
      this.width = canvas.width;
      this.height = canvas.height;
      this.buffer.push(await this._store(canvas));
      await super.add();
    }
    async save() {
      if (this.savedBlob) return this.savedBlob;
      if (!this.buffer.length) return null;
      const ctx = {
        frameCount: this.buffer.length,
        width: this.width,
        height: this.height,
        framerate: this.params.framerate,
        getFrame: (i) => this._restore(this.buffer[i])
      };
      const blob = await this.encodeAll(ctx);
      this.savedBlob = blob;
      return blob;
    }
    /** Subclasses implement this. @returns {Promise<Blob|null>} */
    async encodeAll() {
      throw new Error("BatchEncoder subclass must implement encodeAll(ctx).");
    }
    async dispose() {
      this.buffer = [];
      this.savedBlob = null;
      this._grabCanvas = null;
      this._grabCtx = null;
    }
  };
  _BatchEncoder_instances = new WeakSet();
  ctx_fn = function(width, height) {
    if (!this._grabCtx || this._grabCanvas.width !== width || this._grabCanvas.height !== height) {
      this._grabCanvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : Object.assign(document.createElement("canvas"), { width, height });
      this._grabCtx = this._grabCanvas.getContext("2d", { willReadFrequently: true });
    }
    return this._grabCtx;
  };

  // src/encoders/GifskiEncoder.js
  var DEFAULT_GIFSKI_URL = "https://cdn.jsdelivr.net/npm/gifski-wasm@2.2.0/dist/encode.js";
  var _GifskiEncoder_instances, ctxOf_fn, targetSize_fn, downscale_fn, loadGifski_fn;
  var GifskiEncoder = class extends BatchEncoder {
    constructor(params) {
      super(params);
      __privateAdd(this, _GifskiEncoder_instances);
      this.extension = "gif";
      this.mimeType = "image/gif";
      this.quality = Math.min(100, Math.max(1, params.quality ?? 90));
      this.bufferMode = params.bufferMode || "png";
      this.gifMaxSize = params.gifMaxSize ?? 640;
      this.gifWidth = params.gifWidth || 0;
      this.gifHeight = params.gifHeight || 0;
      this._gifski = typeof params.gifski === "function" ? params.gifski : null;
      this._gifskiUrl = params.gifskiUrl || DEFAULT_GIFSKI_URL;
      this._srcCtx = null;
      this._dstCtx = null;
    }
    async encodeAll({ frameCount, width, height, framerate, getFrame }) {
      const encode = await __privateMethod(this, _GifskiEncoder_instances, loadGifski_fn).call(this);
      const [tw, th] = __privateMethod(this, _GifskiEncoder_instances, targetSize_fn).call(this, width, height);
      const bytes2 = frameCount * tw * th * 4;
      if (bytes2 > 12e8) {
        throw new Error(
          `GIF too large for gifski: ${frameCount} frames \xD7 ${tw}\xD7${th} \u2248 ${Math.round(bytes2 / 1e6)} MB in one buffer. Lower gifMaxSize, framerate, or duration \u2014 or use the streaming "gif" format.`
        );
      }
      const frames = [];
      for (let i = 0; i < frameCount; i++) {
        const full = await getFrame(i);
        frames.push(__privateMethod(this, _GifskiEncoder_instances, downscale_fn).call(this, full, tw, th));
        this.emit("progress", (i + 1) / frameCount * 0.5);
      }
      const data = await encode({
        frames,
        width: tw,
        height: th,
        fps: framerate,
        quality: this.quality
      });
      this.emit("progress", 1);
      return new Blob([data], { type: this.mimeType });
    }
    async dispose() {
      await super.dispose();
      this._srcCtx = null;
      this._dstCtx = null;
    }
  };
  _GifskiEncoder_instances = new WeakSet();
  ctxOf_fn = function(ref, width, height) {
    let ctx = this[ref];
    if (!ctx || ctx.canvas.width !== width || ctx.canvas.height !== height) {
      const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : Object.assign(document.createElement("canvas"), { width, height });
      ctx = canvas.getContext("2d", { willReadFrequently: true });
      this[ref] = ctx;
    }
    return ctx;
  };
  targetSize_fn = function(width, height) {
    if (this.gifWidth && this.gifHeight) {
      return [Math.max(1, this.gifWidth), Math.max(1, this.gifHeight)];
    }
    const longest = Math.max(width, height);
    if (!this.gifMaxSize || longest <= this.gifMaxSize) return [width, height];
    const s = this.gifMaxSize / longest;
    return [Math.max(1, Math.round(width * s)), Math.max(1, Math.round(height * s))];
  };
  downscale_fn = function(image, tw, th) {
    if (image.width === tw && image.height === th) return image;
    const src = __privateMethod(this, _GifskiEncoder_instances, ctxOf_fn).call(this, "_srcCtx", image.width, image.height);
    src.putImageData(image, 0, 0);
    const dst = __privateMethod(this, _GifskiEncoder_instances, ctxOf_fn).call(this, "_dstCtx", tw, th);
    dst.clearRect(0, 0, tw, th);
    dst.drawImage(src.canvas, 0, 0, tw, th);
    return dst.getImageData(0, 0, tw, th);
  };
  loadGifski_fn = async function() {
    if (this._gifski) return this._gifski;
    const mod = await import(
      /* @vite-ignore */
      this._gifskiUrl
    );
    this._gifski = mod.default || mod.encode;
    if (typeof this._gifski !== "function") {
      throw new Error("gifski-wasm module did not export an encode function.");
    }
    return this._gifski;
  };

  // src/index.js
  var src_default = CCapture;

  // src/umd.js
  for (const [key, value] of Object.entries(src_exports)) {
    if (key !== "default") src_default[key] = value;
  }
  (typeof globalThis !== "undefined" ? globalThis : window).CCapture = src_default;
})();
