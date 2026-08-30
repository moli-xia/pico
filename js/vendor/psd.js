class Ge {
  /** @internal */
  constructor(e, t) {
    this.layerFrame = e, this.parent = t, this.type = "Group", this.children = [];
  }
  get name() {
    var e, t;
    return (t = (e = this.layerFrame) === null || e === void 0 ? void 0 : e.layerProperties.name) !== null && t !== void 0 ? t : "";
  }
  get opacity() {
    var e, t;
    return (t = (e = this.layerFrame) === null || e === void 0 ? void 0 : e.layerProperties.opacity) !== null && t !== void 0 ? t : 0;
  }
  get composedOpacity() {
    return this.parent.composedOpacity * (this.opacity / 255);
  }
  get additionalProperties() {
    var e;
    return (e = this.layerFrame) === null || e === void 0 ? void 0 : e.layerProperties.additionalLayerProperties;
  }
  addChild(e) {
    this.children.push(e);
  }
  hasChildren() {
    return this.children.length !== 0;
  }
  freeze() {
    this.children.forEach((e) => {
      var t, n;
      return (n = (t = e).freeze) === null || n === void 0 ? void 0 : n.call(t);
    }), Object.freeze(this.children);
  }
}
var w;
(function(A) {
  A.SectionDividerSetting = "lsct", A.TypeToolObjectSetting = "TySh", A.UnicodeLayerName = "luni", A.VectorStrokeData = "vstk", A.ObjectBasedEffects = "lfx2", A.GradientFillSetting = "GdFl", A.SolidColorSheetSetting = "SoCo", A.PatternFillSetting = "PtFl", A.VectorStrokeContentData = "vscg", A.BlendOptionsCapacity = "iOpa", A.VectorMaskSetting1 = "vmsk", A.VectorMaskSetting2 = "vsms", A.HueSaturation = "hue2", A.NestedSectionDividerSetting = "lsdk", A.LayerId = "lyid", A.ArtboardData = "artb", A.SmartObjectPlacedLayerData = "SoLE", A.PlacedLayerData = "SoLd", A.LinkedLayer = "lnkD", A.LinkedLayer2 = "lnk2", A.LinkedLayer3 = "lnk3";
})(w || (w = {}));
var wA;
(function(A) {
  A[A.Normal = 0] = "Normal", A[A.SceneGroup = 1] = "SceneGroup";
})(wA || (wA = {}));
var Y;
(function(A) {
  A[A.ClosedSubpathLength = 0] = "ClosedSubpathLength", A[A.ClosedSubpathBezierKnotLinked = 1] = "ClosedSubpathBezierKnotLinked", A[A.ClosedSubpathBezierKnotUnlinked = 2] = "ClosedSubpathBezierKnotUnlinked", A[A.OpenSubpathLength = 3] = "OpenSubpathLength", A[A.OpenSubpathBezierKnotLinked = 4] = "OpenSubpathBezierKnotLinked", A[A.OpenSubpathBezierKnotUnlinked = 5] = "OpenSubpathBezierKnotUnlinked", A[A.PathFillRule = 6] = "PathFillRule", A[A.Clipboard = 7] = "Clipboard", A[A.InitialFillRule = 8] = "InitialFillRule";
})(Y || (Y = {}));
const uA = (A, e) => {
  const t = Math.max(A.length, e.length);
  for (let n = 0; n < t; n++)
    if (A[n] !== e[n])
      return !1;
  return !0;
};
class o extends Error {
  // Workaround to properly set the prototype chain in Node.js
  // See:
  // - https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
  // - https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html#support-for-newtarget
  constructor(e) {
    super(e), Object.setPrototypeOf(this, new.target.prototype), this.name = new.target.name;
  }
}
class Le extends o {
}
class zA extends o {
}
class Me extends o {
}
class Re extends o {
}
class Ue extends o {
}
class be extends o {
}
class Ye extends o {
}
class me extends o {
}
class Je extends o {
}
class ve extends o {
}
class XA extends o {
}
class WA extends o {
}
class He extends o {
}
class xe extends o {
}
class je extends o {
}
class _e extends o {
}
class Oe extends o {
}
class Ke extends o {
}
class Pe extends o {
}
class qe extends o {
}
class Ze extends o {
}
class Te extends o {
}
class Ve extends o {
}
class ze extends o {
}
class nA extends o {
}
class $A extends o {
}
class Xe extends o {
}
class bA extends o {
}
class CA extends o {
}
class We extends o {
}
class $e extends o {
}
class At extends o {
}
class et extends o {
}
class tt extends o {
}
class nt extends o {
}
class gt extends o {
}
class at extends o {
}
class it extends o {
}
class It extends o {
}
class Bt extends o {
}
class YA extends o {
}
class EA extends o {
}
class st extends o {
}
class Qt extends o {
}
function Ae(A, e) {
  const t = A.getUint32(e), n = A.getUint32(e + 4);
  if (t >= 2097152)
    throw new $A();
  return t * 4294967296 + n;
}
function ot(A, e) {
  const t = A.getInt32(e), n = A.getUint32(e + 4);
  if (t >= 2097152 || t < -2097152 || t === -2097152 && n === 0)
    throw new $A();
  return t * 4294967296 + n;
}
const rt = {
  u8: 1,
  i8: 1,
  u16: 2,
  i16: 2,
  u32: 4,
  i32: 4,
  f32: 4,
  u64: 8,
  i64: 8,
  f64: 8
};
class O {
  static from(e) {
    return new O(new DataView(e.buffer, e.byteOffset, e.byteLength));
  }
  constructor(e, t = 0) {
    this.dataView = e, this.position = t;
  }
  /**
   * Length of the data covered by this Cursor.
   */
  get length() {
    return this.dataView.byteLength;
  }
  /**
   * Clones the cursor, optionally specifying a new cursor position.
   */
  clone(e) {
    const t = e !== void 0 ? e : this.position;
    return new O(new DataView(this.dataView.buffer, this.dataView.byteOffset, this.dataView.byteLength), t);
  }
  pass(e) {
    this.position += e;
  }
  unpass(e) {
    this.position -= e;
  }
  /**
   * Creates a `Uint8Array` that covers the underlying `ArrayBuffer` of this
   * cursor, starting at the current cursor position and spanning a
   * {@link length} number of bytes.
   * This does not advance the cursor.
   */
  extract(e) {
    if (this.position + e > this.dataView.byteLength)
      throw new qe();
    return new Uint8Array(this.dataView.buffer, this.dataView.byteOffset + this.position, e);
  }
  iter() {
    return new Uint8Array(this.dataView.buffer, this.dataView.byteOffset + this.position);
  }
  /**
   * Creates a `Uint8Array` that covers the underlying `ArrayBuffer` of this
   * cursor, starting at the current cursor position and spanning a
   * {@link length} number of bytes.
   * This advances the cursor by `length` bytes.
   */
  take(e) {
    const t = this.extract(e);
    return this.pass(e), t;
  }
  /**
   * Returns subsequent byte, without advancing position
   */
  peek() {
    return this.dataView.getUint8(this.position);
  }
  /**
   * Returns subsequent byte
   */
  one() {
    const e = this.dataView.getUint8(this.position);
    return this.position += 1, e;
  }
  /**
   * Reads a number at the current cursor position, using the given {@link type}
   * (big endian).
   * This advances the cursor by the size of the data `type`.
   */
  read(e) {
    const { dataView: t, position: n } = this;
    switch (this.pass(rt[e]), e) {
      case "u8":
        return t.getUint8(n);
      case "u16":
        return t.getUint16(n);
      case "u32":
        return t.getUint32(n);
      case "u64":
        return Ae(t, n);
      case "i8":
        return t.getInt8(n);
      case "i16":
        return t.getInt16(n);
      case "i32":
        return t.getInt32(n);
      case "i64":
        return ot(t, n);
      case "f32":
        return t.getFloat32(n);
      case "f64":
        return t.getFloat64(n);
      default:
        throw new TypeError(`Invalid ReadType: ${e}`);
    }
  }
  /**
   * Reads {@link length} bytes of data and decodes it as a UTF-8 string.
   * This advances the cursor by `length` bytes.
   * @param length Length of the data to read in bytes
   * @returns Decoded string
   */
  readString(e) {
    const t = this.take(e);
    return new TextDecoder().decode(t);
  }
  /**
   * Reads the length of the string (u32 field) at the current cursor position,
   * then reads the rest of the string and decodes it as UTF-16BE.
   * This advances the cursor.
   *
   * If {@link padding} is specified, this skips additional bytes until the
   * total number of bytes advanced is a multiple of `padding`
   * @param padding Padding (alignment) byte count
   * @returns Decoded string
   */
  // TODO: Default padding of 4 is probably nonsensical and surprising.
  // Let's change it to 0 and update all call sites.
  readUnicodeString(e = 4) {
    const n = this.read("u32") * 2, g = this.take(n), a = new TextDecoder("utf-16be").decode(g);
    return this.padding(4 + n, e), a.charCodeAt(a.length - 1) === 0 ? a.slice(0, -1) : a;
  }
  /**
   * Reads unsigned 4-byte fixed-point number.
   * 32 bits in 16.16 setup
   * https://github.com/meltingice/psd.js/blob/333dd1467452a3353018c2856e3e4fb0e07d0025/lib/psd/resources/resolution_info.coffee#L10
   */
  readFixedPoint32bit() {
    return this.read("u32") / 65536;
  }
  /**
   * Decodes an "ID string", which is a compact string format used in
   * Descriptors.
   *
   * Reads the length of the string (u32 field) at the current cursor position,
   * then reads the rest of the string and decodes it as UTF-8.
   * If the value of the length field is 0, this always decodes 4 bytes of
   * characters.
   */
  readIdString() {
    const e = this.read("u32");
    return this.readString(e || 4);
  }
  /**
   * Skips an amount of bytes so that a {@link size}-byte block is aligned to a
   * multiple of {@link divisor}.
   *
   * @example
   * // Skips 5 bytes, which aligns a 75-byte block to a
   * // multiple of 8
   * cursor.padding(75, 8);
   *
   * @param size Value to align against
   * @param divisor Alignment number (can be 0)
   */
  padding(e, t) {
    const n = e % t;
    n > 0 && this.pass(t - n);
  }
}
const cA = (A, e, t) => e <= A && A <= t;
function aA(A) {
  return A.bottom - A.top;
}
function Ct(A) {
  return A.right - A.left;
}
function mA(A) {
  return Ct(A) * aA(A);
}
var iA;
(function(A) {
  A.PassThrough = "pass", A.Normal = "norm", A.Dissolve = "diss", A.Darken = "dark", A.Multiply = "mul ", A.ColorBurn = "idiv", A.LinearBurn = "lbrn", A.DarkerColor = "dkCl", A.Lighten = "lite", A.Screen = "scrn", A.ColorDodge = "div ", A.LinearDodge = "lddg", A.LighterColor = "lgCl", A.Overlay = "over", A.SoftLight = "sLit", A.HardLight = "hLit", A.VividLight = "vLit", A.LinearLight = "lLit", A.PinLight = "pLit", A.HardMix = "hMix", A.Difference = "diff", A.Exclusion = "smud", A.Subtract = "fsub", A.Divide = "fdiv", A.Hue = "hue ", A.Saturation = "sat ", A.Color = "colr", A.Luminosity = "lum ";
})(iA || (iA = {}));
function ee(A) {
  const e = Object.keys(iA);
  for (const t of e)
    if (iA[t] === A)
      return A;
  throw new ve();
}
var z;
(function(A) {
  A[A.Base = 0] = "Base", A[A.NonBase = 1] = "NonBase";
})(z || (z = {}));
function Et(A) {
  if (A === z.Base)
    return z.Base;
  if (A === z.NonBase)
    return z.NonBase;
  throw new _e();
}
var fA;
(function(A) {
  A[A.Bitmap = 0] = "Bitmap", A[A.Grayscale = 1] = "Grayscale", A[A.Indexed = 2] = "Indexed", A[A.Rgb = 3] = "Rgb", A[A.Cmyk = 4] = "Cmyk", A[A.Multichannel = 7] = "Multichannel", A[A.Duotone = 8] = "Duotone", A[A.Lab = 9] = "Lab";
})(fA || (fA = {}));
var yA;
(function(A) {
  A[A.One = 1] = "One", A[A.Eight = 8] = "Eight", A[A.Sixteen = 16] = "Sixteen", A[A.ThirtyTwo = 32] = "ThirtyTwo";
})(yA || (yA = {}));
var c;
(function(A) {
  A.Alias = "alis", A.Boolean = "bool", A.Class = "type", A.Descriptor = "Objc", A.Double = "doub", A.Enumerated = "enum", A.GlobalClass = "GlbC", A.GlobalObject = "GlbO", A.Integer = "long", A.LargeInteger = "comp", A.List = "VlLs", A.RawData = "tdta", A.Reference = "obj ", A.String = "TEXT", A.UnitFloat = "UntF", A.UnitFloats = "UnFl", A.ObjectArray = "ObAr";
})(c || (c = {}));
var SA;
(function(A) {
  A.Angle = "#Ang", A.Density = "#Rsl", A.Distance = "#Rlt", A.Millimeters = "#Mlm", A.None = "#Nne", A.Percent = "#Prc", A.Pixels = "#Pxl", A.Points = "#Pnt";
})(SA || (SA = {}));
function V(A, e, t) {
  const n = A.items.get(e);
  if (!n)
    throw new tt(`Cannot find key "${e}" in descriptor`);
  if (n.type !== t)
    throw new nt(`Unexpected descriptor value type: expected "${t}" but got "${n.type}"`);
  return n;
}
var eA;
(function(A) {
  A[A.PSD = 1] = "PSD", A[A.PSB = 2] = "PSB";
})(eA || (eA = {}));
const ct = [56, 66, 80, 83], dt = [0, 0, 0, 0, 0, 0], lt = [1, 8, 16, 32], ht = 1, Dt = 56, JA = 1;
function wt(A) {
  const e = new O(A), t = e.take(4);
  if (!uA(t, ct))
    throw new Le();
  const n = e.read("u16");
  if (!(n === eA.PSD || n === eA.PSB))
    throw new zA();
  const g = RA(n), a = e.take(6);
  if (!uA(a, dt))
    throw new Me();
  const i = e.read("u16");
  if (!cA(i, ht, Dt))
    throw new be();
  const s = e.read("u32"), I = e.read("u32");
  if (!cA(s, JA, g.maxPixels) || !cA(I, JA, g.maxPixels))
    throw new Ye();
  const Q = e.read("u16");
  if (!lt.includes(Q))
    throw new Ue();
  const r = e.read("u16");
  if (!(r in fA))
    throw new Re();
  return {
    channelCount: i,
    version: n,
    width: I,
    height: s,
    depth: Q,
    colorMode: r
  };
}
function ut(A, e, t) {
  const n = (A.length - 2) / t, g = A.extract(n), a = t >= 2 ? A.extract(n) : void 0, i = t >= 3 ? A.extract(n) : void 0, s = t >= 4 ? A.extract(n) : void 0;
  if (e === yA.Eight)
    return { red: g, green: a, blue: i, alpha: s };
  throw new He(`Unsupported image bit depth: ${e}`);
}
function ft(A, e, t, n) {
  let g = 0, a = 0, i = 0, s = 0;
  const I = n.rleScanlineLengthFieldReadType;
  for (let f = 0; f < t; f++)
    g += A.read(I);
  if (e >= 2)
    for (let f = 0; f < t; f++)
      a += A.read(I);
  if (e >= 3)
    for (let f = 0; f < t; f++)
      i += A.read(I);
  if (e === 4)
    for (let f = 0; f < t; f++)
      s += A.read(I);
  const Q = 2 + e * t * n.rleScanlineLengthFieldSize, r = A.clone(Q), u = r.take(g), L = a ? r.take(a) : void 0, E = i ? r.take(i) : void 0, d = s ? r.take(s) : void 0;
  return { red: u, green: L, blue: E, alpha: d };
}
function yt(A, e, t, n, g) {
  const a = new O(A), i = a.read("u16");
  if (!(i in H))
    throw new XA();
  const { red: s, green: I, blue: Q, alpha: r } = (() => {
    switch (i) {
      case H.RawData:
        return ut(a, e, n);
      case H.RleCompressed:
        return ft(a, n, t, g);
      default:
        throw new WA();
    }
  })();
  return {
    compression: i,
    red: s,
    green: I,
    blue: Q,
    alpha: r
  };
}
function St(A) {
  const e = A.read("u32");
  if (e !== 1)
    throw new Ze();
  const t = A.read("u32"), n = A.read("u32"), g = A.read("u32"), a = [];
  for (let i = 0; i < g; ++i) {
    const s = A.read("i32"), I = Fn(A.read("u8"));
    a.push({ position: s, direction: I });
  }
  return { version: e, gridSizeX: t, gridSizeY: n, guides: a };
}
function kt(A, e) {
  return A.take(e - A.position);
}
function pt(A) {
  const e = A.readFixedPoint32bit(), t = A.read("u16"), n = A.read("u16"), g = A.readFixedPoint32bit(), a = A.read("u16"), i = A.read("u16");
  return {
    horizontal: e,
    horizontalUnit: t,
    widthUnit: n,
    vertical: g,
    verticalUnit: a,
    heightUnit: i
  };
}
function Nt(A, e) {
  const t = A.read("u32");
  if (t === 6) {
    const n = A.read("i32"), g = A.read("i32"), a = A.read("i32"), i = A.read("i32"), s = A.readUnicodeString(0), I = A.read("u32"), Q = [];
    for (; Q.length < I; ) {
      const u = A.read("u32"), L = A.read("u32"), E = Gn(A.read("u32")), d = E === 1 ? A.read("u32") : void 0;
      Q.push({
        id: u,
        groupId: L,
        origin: E,
        associatedLayerId: d,
        name: A.readUnicodeString(0),
        type: A.read("u32"),
        left: A.read("i32"),
        top: A.read("i32"),
        right: A.read("i32"),
        bottom: A.read("i32"),
        url: A.readUnicodeString(0),
        target: A.readUnicodeString(0),
        message: A.readUnicodeString(0),
        altTag: A.readUnicodeString(0),
        isCellTextHtml: !!A.read("u8"),
        cellText: A.readUnicodeString(0),
        horizontalAlignment: A.read("i32"),
        verticalAlignment: A.read("i32"),
        alpha: A.read("u8"),
        red: A.read("u8"),
        green: A.read("u8"),
        blue: A.read("u8")
      });
    }
    const r = A.position < e ? m(A) : void 0;
    return {
      version: t,
      boundTop: n,
      boundLeft: g,
      boundBottom: a,
      boundRight: i,
      sliceGroupName: s,
      slices: Q,
      descriptor: r
    };
  } else if (t === 7 || t === 8) {
    const n = m(A);
    return { version: t, descriptor: n };
  } else
    throw new Ve(`Invalid Slices section version: ${t}`);
}
const Ft = [56, 66, 73, 77];
function Gt(A) {
  const e = new O(A), t = [], n = e.read("u32");
  for (; e.position < n; ) {
    const g = Lt(e);
    t.push(g);
  }
  return { resources: t };
}
function Lt(A) {
  const e = A.take(4);
  if (!uA(e, Ft))
    throw new Pe();
  const t = A.read("i16"), n = Mt(A, 2), g = A.read("u32"), a = A.position + g, i = g + g % 2, s = A.position;
  let I = null;
  switch (t) {
    case U.GridAndGuides:
      I = St(A);
      break;
    case U.Slices:
      I = Nt(A, a);
      break;
    case U.ICCProfile:
      I = kt(A, a);
      break;
    case U.ResolutionInfo:
      I = pt(A);
      break;
    case U.GlobalLightAltitude:
      I = A.read("i32");
      break;
    case U.GlobalLightAngle:
      I = A.read("i32");
      break;
  }
  const Q = A.position, r = s + i - Q;
  return r > 0 && A.pass(r), { id: t, name: n, resource: I };
}
function Mt(A, e = 0) {
  const t = A.read("u8"), n = A.readString(t);
  if (e) {
    const g = (t + 1) % e;
    g > 0 && A.pass(e - g);
  }
  return n;
}
function te(A) {
  const e = {};
  for (const [t, n] of A)
    e[t] = n;
  return e;
}
const ne = (A, e, t) => {
  const { top: n, left: g, bottom: a, right: i, opacity: s, clipping: I, hidden: Q, transparencyLocked: r, blendMode: u, layerText: L, engineData: E, maskData: d, additionalLayerInfos: f } = e, k = te(f.map((R) => [R.key, R]));
  return {
    name: A,
    top: n,
    left: g,
    bottom: a,
    right: i,
    opacity: s,
    clippingMask: I,
    hidden: Q,
    transparencyLocked: r,
    blendMode: u,
    groupId: t,
    text: L,
    textProperties: E,
    maskData: d,
    additionalLayerProperties: k
  };
};
class LA {
  static create(e, t, n) {
    const g = ne(e.name, e, n);
    return new LA(t, g);
  }
  constructor(e, t) {
    this.channels = e, this.layerProperties = t;
  }
  get red() {
    const e = this.channels.get(M.Red);
    if (e === void 0)
      throw new je();
    return e;
  }
  get green() {
    return this.channels.get(M.Green);
  }
  get blue() {
    return this.channels.get(M.Blue);
  }
  get alpha() {
    return this.channels.get(M.TransparencyMask);
  }
  get userMask() {
    return this.channels.get(M.UserSuppliedLayerMask);
  }
  get realUserMask() {
    return this.channels.get(M.RealUserSuppliedLayerMask);
  }
  get width() {
    const { right: e, left: t } = this.layerProperties;
    return e - t + 1;
  }
  get height() {
    const { bottom: e, top: t } = this.layerProperties;
    return e - t + 1;
  }
}
class MA {
  static create(e, t, n, g) {
    const a = ne(e, n, g);
    return new MA(t, a);
  }
  constructor(e, t) {
    this.id = e, this.layerProperties = t;
  }
}
function Rt(A) {
  return { data: m(A) };
}
function Ut(A) {
  return { fillOpacity: A.read("u8") };
}
function bt(A) {
  return { data: m(A) };
}
function kA(A) {
  const e = A.read("i16"), t = A.read("i16"), n = A.read("i16");
  return {
    hue: e,
    saturation: t,
    lightness: n
  };
}
function Yt(A) {
  const e = A.read("i16"), t = A.read("i16"), n = A.read("i16"), g = A.read("i16");
  return {
    beginRamp: e,
    beginSustain: t,
    endSustain: n,
    endRamp: g,
    ...kA(A)
  };
}
function mt(A) {
  return Array.from(Array(6), () => Yt(A));
}
function Jt(A) {
  const e = A.read("u16"), t = A.read("u8");
  A.pass(1);
  const n = kA(A), g = kA(A);
  return {
    version: e,
    colorize: t,
    colorization: n,
    master: g,
    adjustment: t ? void 0 : mt(A)
  };
}
function vt(A) {
  return { value: A.read("u32") };
}
function Ht(A, e) {
  const t = [];
  let n = 0;
  const g = A.position + e;
  for (; A.position < g && (n = A.read("u64")); ) {
    const a = A.position, i = xt(A);
    t.push(i);
    const s = A.position - a, I = n - s;
    A.pass(I), A.padding(A.position, 4);
  }
  return { layers: t };
}
function xt(A) {
  const e = A.readString(4);
  if (e !== "liFD")
    throw new We(`unknown layer type: '${e}'`);
  const t = A.read("i32"), n = jt(A), g = A.readUnicodeString(0), a = A.readString(4), i = A.readString(4), s = A.read("u64"), Q = A.read("u8") ? m(A) : void 0, r = A.take(s), u = t > 5 ? A.readUnicodeString() : void 0;
  return {
    layerType: e,
    version: t,
    uniqueId: n,
    filename: g,
    filetype: a,
    creator: i,
    data: Q,
    contents: r,
    uuid: u
  };
}
function jt(A) {
  const e = A.read("u8");
  return A.readString(e);
}
function _t(A) {
  const e = A.read("u32"), t = A.read("u32"), n = IA(A);
  return { version: e, descriptor: n, descriptorVersion: t };
}
function Ot(A) {
  return { data: m(A) };
}
function Kt(A, e) {
  const t = Nn(A.read("u32"));
  if (e < 12)
    return { dividerType: t };
  const n = A.readString(4);
  if (n !== "8BIM")
    throw new bA(`Invalid Section Divider Setting signature: ${n}`);
  const g = ee(A.readString(4));
  if (e < 16)
    return { dividerType: t, dividerSignature: n, blendMode: g };
  const a = A.read("u32");
  if (!(a in wA))
    throw new bA(`Invalid Section Divider Setting subtype: ${a}`);
  return { dividerType: t, dividerSignature: n, blendMode: g, subType: a };
}
function Pt(A) {
  const e = A.readString(4), t = A.read("u32");
  return { data: m(A), version: t, identifier: e };
}
function qt(A) {
  const e = A.read("u32"), t = IA(A);
  return { version: e, data: t };
}
function Zt(A) {
  const e = A.read("u16");
  if (e !== 1)
    throw new CA(`Invalid type tool object setting version: ${e}`);
  const t = A.read("f64"), n = A.read("f64"), g = A.read("f64"), a = A.read("f64"), i = A.read("f64"), s = A.read("f64"), I = A.read("u16");
  if (I !== 50)
    throw new CA(`Invalid text version: ${I}`);
  const Q = m(A), r = A.read("u16");
  if (r !== 1)
    throw new CA(`Invalid warp version: ${r}`);
  const u = m(A), L = A.read("f64"), E = A.read("f64"), d = A.read("f64"), f = A.read("f64");
  return {
    version: e,
    transformXX: t,
    transformXY: n,
    transformYX: g,
    transformYY: a,
    transformTX: i,
    transformTY: s,
    textVersion: I,
    textData: Q,
    warpVersion: r,
    warpData: u,
    left: L,
    top: E,
    right: d,
    bottom: f
  };
}
function Tt(A) {
  return { name: A.readUnicodeString(0) };
}
function vA(A) {
  const [e, ...t] = A.take(4), n = t[0] * 2 ** 16 + t[1] * 2 ** 8 + t[2];
  return e + n / 2 ** 24;
}
function dA(A) {
  const e = vA(A), t = vA(A);
  return { vert: e, horiz: t };
}
function Vt(A, e) {
  const t = A.read("i16"), n = A.read("i16"), g = A.read("i16");
  A.pass(6);
  const a = A.read("i16");
  return A.pass(10), {
    type: e,
    length: t,
    operation: n,
    subpathType: g,
    index: a
  };
}
function zt(A, e) {
  const t = Array(4).map(() => A.read("f32")), n = A.read("f32");
  return A.pass(6), { type: e, bounds: t, resolution: n };
}
function Xt(A, e) {
  const t = !!(A.read("i16") & 1);
  return A.pass(22), { type: e, fill: t };
}
function Wt(A, e) {
  const t = dA(A), n = dA(A), g = dA(A);
  return { type: e, preceding: t, anchor: n, leaving: g };
}
function $t(A) {
  const e = A.read("u16");
  switch (e) {
    case Y.OpenSubpathLength:
    case Y.ClosedSubpathLength:
      return Vt(A, e);
    case Y.PathFillRule:
      return A.pass(24), { type: e };
    case Y.Clipboard:
      return zt(A, e);
    case Y.InitialFillRule:
      return Xt(A, e);
    case Y.ClosedSubpathBezierKnotLinked:
    case Y.ClosedSubpathBezierKnotUnlinked:
    case Y.OpenSubpathBezierKnotLinked:
    case Y.OpenSubpathBezierKnotUnlinked:
      return Wt(A, e);
    default:
      throw new Error(`Unknown PathRecordType: ${e} (bug in offsets?)`);
  }
}
function An(A, e) {
  const t = Math.floor(e / 26);
  return Array.from(Array(t), () => $t(A));
}
function en(A, e) {
  const t = A.read("u32"), n = A.read("u32"), g = An(A, e);
  return {
    version: t,
    pathRecords: g,
    invert: !!(n & 1),
    notLink: !!(n & 2),
    disable: !!(n & 4)
  };
}
function tn(A) {
  const e = A.read("u32"), t = m(A);
  return { version: e, data: t };
}
function nn(A) {
  return { data: m(A) };
}
function ge(A, e, t = 0) {
  const n = A.readString(4);
  if (n !== "8BIM" && n !== "8B64")
    throw new Xe(`Invalid signature: ${n}`);
  const g = A.readString(4), a = A.read(an(g, e)), i = A.position, s = gn(A, n, g, a), I = a - (A.position - i);
  return A.pass(I), A.padding(a, t), s;
}
function gn(A, e, t, n) {
  switch (t) {
    case w.NestedSectionDividerSetting:
    case w.SectionDividerSetting:
      return {
        signature: e,
        key: t,
        ...Kt(A, n)
      };
    case w.TypeToolObjectSetting:
      return { signature: e, key: t, ...Zt(A) };
    case w.UnicodeLayerName:
      return { signature: e, key: t, ...Tt(A) };
    case w.VectorStrokeData:
      return { signature: e, key: t, ...nn(A) };
    case w.ObjectBasedEffects:
      return { signature: e, key: t, ..._t(A) };
    case w.GradientFillSetting:
      return { signature: e, key: t, ...bt(A) };
    case w.SolidColorSheetSetting:
      return { signature: e, key: t, ...qt(A) };
    case w.PatternFillSetting:
      return { signature: e, key: t, ...Ot(A) };
    case w.VectorStrokeContentData:
      return { signature: e, key: t, ...tn(A) };
    case w.BlendOptionsCapacity:
      return { signature: e, key: t, ...Ut(A) };
    case w.VectorMaskSetting1:
    case w.VectorMaskSetting2:
      return { signature: e, key: t, ...en(A, n) };
    case w.HueSaturation:
      return { signature: e, key: t, ...Jt(A) };
    case w.LayerId:
      return { signature: e, key: t, ...vt(A) };
    case w.ArtboardData:
      return { signature: e, key: t, ...Rt(A) };
    case w.PlacedLayerData:
    case w.SmartObjectPlacedLayerData:
      return {
        signature: e,
        key: t,
        ...Pt(A)
      };
    case w.LinkedLayer:
    case w.LinkedLayer2:
    case w.LinkedLayer3:
      return {
        signature: e,
        key: t,
        ...Ht(A, n)
      };
    default: {
      const g = A.take(n);
      return { signature: e, key: t, _isUnknown: !0, data: g };
    }
  }
}
function an(A, e) {
  if (e.aliLengthFieldSizeIsVariable)
    switch (A) {
      case "LMsk":
      case "Lr16":
      case "Lr32":
      case "Layr":
      case "Mt16":
      case "Mt32":
      case "Mtrn":
      case "Alph":
      case "FMsk":
      case "Ink2":
      case "FEid":
      case "FXid":
      case "PxSD":
      case "cinf":
        return "u64";
    }
  return "u32";
}
const In = "8BIM";
function Bn(A, e, t) {
  const n = [];
  for (; n.length < e; )
    n.push(sn(A, t));
  return n.map((a) => {
    const i = cn(A, a.channelInformation, a, t);
    return [a, i];
  }).reverse();
}
function sn(A, e) {
  const [t, n, g, a] = on(A), i = A.read("u16"), s = [];
  for (; s.length < i; ) {
    const N = A.read("i16"), BA = A.read(e.layerRecordSectionChannelLengthFieldReadType) - 2;
    s.push([N, BA]);
  }
  if (A.readString(4) !== In)
    throw new me();
  const I = ee(A.readString(4)), Q = A.read("u8"), r = Et(A.read("u8")), { hidden: u, transparencyLocked: L } = rn(A);
  A.pass(1);
  const E = A.read("u32"), d = A.position, f = ln(A);
  A.pass(A.read("u32"));
  const k = A.read("u8");
  let R = A.readString(k);
  A.padding(k + 1, 4);
  const b = [];
  for (; A.position - d < E; )
    b.push(ge(A, e));
  let q, J, gA;
  for (const x of b)
    if (!x._isUnknown)
      switch (x.key) {
        case w.SectionDividerSetting:
          ({ dividerType: q } = x);
          break;
        case w.TypeToolObjectSetting: {
          const N = x.textData.descriptor.items.get("Txt ");
          N && N.type === c.String && (J = N.value);
          const Z = x.textData.descriptor.items.get("EngineData");
          Z && Z.type === c.RawData && (gA = _n(Z.data));
          break;
        }
        case w.UnicodeLayerName:
          ({ name: R } = x);
          break;
      }
  return {
    name: R,
    channelInformation: s,
    top: t,
    left: n,
    bottom: g,
    right: a,
    hidden: u,
    transparencyLocked: L,
    opacity: Q,
    clipping: r,
    blendMode: I,
    additionalLayerInfos: b,
    dividerType: q,
    layerText: J,
    engineData: gA,
    maskData: f
  };
}
function Qn(A, e) {
  const t = [];
  for (; A.position < A.length; )
    t.push(ge(
      A,
      e,
      /* padding */
      4
    ));
  return te(t.map((n) => [n.key, n]));
}
function on(A) {
  const e = A.read("i32"), t = A.read("i32");
  let n = A.read("i32");
  n !== 0 && (n -= 1);
  let g = A.read("i32");
  return g !== 0 && (g -= 1), [e, t, n, g];
}
function rn(A) {
  const e = A.read("u8");
  return {
    transparencyLocked: !!(e & 1),
    // Adobe's docs say this means "visible", but this actually marks "hidden" layers
    hidden: !!(e & 2)
  };
}
function Cn(A) {
  const e = A.maskData.realData;
  if (!e)
    throw new Error("missing real mask data");
  return e;
}
function En(A, e) {
  switch (e) {
    case M.UserSuppliedLayerMask:
      return aA(A.maskData);
    case M.RealUserSuppliedLayerMask:
      return aA(Cn(A));
    default:
      return aA(A) + 1;
  }
}
function cn(A, e, t, n) {
  const g = /* @__PURE__ */ new Map(), { length: a } = e;
  for (let i = 0; i < a; i++) {
    const [s, I] = e[i], Q = kn(A.read("u16"));
    switch (Q) {
      case H.RawData: {
        const r = A.take(I);
        g.set(s, { compression: Q, data: r });
        break;
      }
      case H.RleCompressed: {
        const r = A.take(
          // Do not attempt to take more than the length of the channel data.
          // This is needed because some layers (e.g. gradient fill layers) may
          // have empty channel data (channelDataLength === 0).
          I > 0 ? dn(A, En(t, s), n.rleScanlineLengthFieldReadType) : I
        );
        g.set(s, { compression: Q, data: r });
        break;
      }
    }
  }
  return g;
}
function dn(A, e, t) {
  return Array.from(Array(e), () => A.read(t)).reduce((g, a) => g + a);
}
function ln(A) {
  const e = A.read("u32"), t = A.position, [n, g, a, i] = ae(A), s = A.read("u8"), I = ie(A), Q = e >= 36 ? Dn(A) : void 0, r = I.masksHaveParametersApplied ? hn(A) : void 0, u = e - (A.position - t);
  return A.pass(u), {
    top: n,
    left: g,
    bottom: a,
    right: i,
    backgroundColor: s,
    flags: I,
    parameters: r,
    realData: Q
  };
}
function ae(A) {
  return Array.from(Array(4), () => A.read("i32"));
}
var P;
(function(A) {
  A[A.PositionRelativeToLayer = 1] = "PositionRelativeToLayer", A[A.LayerMaskDisabled = 2] = "LayerMaskDisabled", A[A.InvertMaskWhenBlending = 4] = "InvertMaskWhenBlending", A[A.UserMaskFromRenderingOtherData = 8] = "UserMaskFromRenderingOtherData", A[A.MasksHaveParametersApplied = 16] = "MasksHaveParametersApplied";
})(P || (P = {}));
function ie(A) {
  const e = A.read("u8");
  return {
    // bit 0 = position relative to layer
    positionRelativeToLayer: !!(e & P.PositionRelativeToLayer),
    // bit 1 = layer mask disabled
    layerMaskDisabled: !!(e & P.LayerMaskDisabled),
    // bit 2 = invert layer mask when blending (Obsolete)
    invertMaskWhenBlending: !!(e & P.InvertMaskWhenBlending),
    // bit 3 = indicates that the user mask actually came from rendering other data
    userMaskFromRenderingOtherData: !!(e & P.UserMaskFromRenderingOtherData),
    // bit 4 = indicates that the user and/or vector masks have parameters applied to them
    masksHaveParametersApplied: !!(e & P.MasksHaveParametersApplied)
  };
}
var X;
(function(A) {
  A[A.UserMaskDensity = 1] = "UserMaskDensity", A[A.UserMaskFeather = 2] = "UserMaskFeather", A[A.VectorMaskDensity = 4] = "VectorMaskDensity", A[A.VectorMaskFeather = 8] = "VectorMaskFeather";
})(X || (X = {}));
function hn(A) {
  const e = A.read("u8");
  return {
    // bit 0 = user mask density, 1 byte
    userMaskDensity: e & X.UserMaskDensity ? A.read("u8") : void 0,
    // bit 1 = user mask feather, 8 byte, double
    userMaskFeather: e & X.UserMaskFeather ? A.read("f64") : void 0,
    // bit 2 = vector mask density, 1 byte
    vectorMaskDensity: e & X.VectorMaskDensity ? A.read("u8") : void 0,
    // bit 3 = vector mask feather, 8 bytes, double
    vectorMaskFeather: e & X.VectorMaskFeather ? A.read("f64") : void 0
  };
}
function Dn(A) {
  const e = ie(A), t = A.read("u8"), [n, g, a, i] = ae(A);
  return { top: n, left: g, bottom: a, right: i, flags: e, backgroundColor: t };
}
function wn(A, e) {
  const t = new O(A);
  t.pass(e.layerAndMaskSectionLengthFieldSize), t.pass(e.layerInfoSectionLengthFieldSize);
  const n = t.read("i16"), g = Math.abs(n), a = Bn(t, g, e);
  t.padding(t.position, 4), t.pass(t.read("u32"));
  const i = Qn(t, e), s = [], I = [], Q = [], u = [{
    startIndex: 0,
    groupId: 0,
    parentGroupId: 0
  }];
  let L = 0;
  for (let E = 0; E < g; E++) {
    const [d, f] = a[E], k = u[u.length - 1].groupId, { dividerType: R } = d;
    if (R === $.CloseFolder || R === $.OpenFolder)
      L += 1, u.push({
        startIndex: s.length,
        groupId: L,
        parentGroupId: k,
        layerRecord: d
      }), Q.push("G");
    else if (R === $.BoundingSection) {
      const b = u.pop();
      if (b === void 0)
        throw new Oe();
      const q = b.groupId > 0 ? b.groupId : void 0, J = b.layerRecord || d;
      I.push(MA.create(J.name, b.groupId, J, q)), Q.push("D");
    } else
      s.push(LA.create(d, f, k)), Q.push("L");
  }
  return I.sort((E, d) => E.id - d.id), { layers: s, groups: I, orders: Q, globalAdditionalLayerInformation: i };
}
const un = 26;
function lA(A, e, t = 4) {
  const g = (t === 4 ? A.getUint32(e) : Ae(A, e)) + t;
  return { start: e, end: e + g, size: g };
}
function fn(A) {
  const e = new DataView(A), t = 0, n = un, g = new DataView(A, t, n), a = wt(g), i = RA(a.version), s = lA(e, t + n), I = lA(e, s.end), Q = lA(e, I.end, i.layerAndMaskSectionLengthFieldSize);
  return {
    fileHeader: a,
    colorModeData: new DataView(A, s.size),
    imageResources: new DataView(A, I.start, I.size),
    layerAndMaskInformation: new DataView(A, Q.start, Q.size),
    imageData: new DataView(A, Q.end)
  };
}
const yn = {
  maxPixels: 3e4,
  rleScanlineLengthFieldSize: 2,
  rleScanlineLengthFieldReadType: "u16",
  layerAndMaskSectionLengthFieldSize: 4,
  layerInfoSectionLengthFieldSize: 4,
  layerRecordSectionChannelLengthFieldReadType: "u32",
  aliLengthFieldSizeIsVariable: !1
}, Sn = {
  maxPixels: 3e5,
  rleScanlineLengthFieldSize: 4,
  rleScanlineLengthFieldReadType: "u32",
  layerAndMaskSectionLengthFieldSize: 8,
  layerInfoSectionLengthFieldSize: 8,
  layerRecordSectionChannelLengthFieldReadType: "u64",
  aliLengthFieldSizeIsVariable: !0
};
function RA(A) {
  switch (A) {
    case eA.PSD:
      return yn;
    case eA.PSB:
      return Sn;
    default:
      throw new zA();
  }
}
var H;
(function(A) {
  A[A.RawData = 0] = "RawData", A[A.RleCompressed = 1] = "RleCompressed", A[A.ZipWithoutPrediction = 2] = "ZipWithoutPrediction", A[A.ZipWithPrediction = 3] = "ZipWithPrediction";
})(H || (H = {}));
function kn(A) {
  if (!(A in H))
    throw new XA();
  return A;
}
var M;
(function(A) {
  A[A.Red = 0] = "Red", A[A.Green = 1] = "Green", A[A.Blue = 2] = "Blue", A[A.TransparencyMask = -1] = "TransparencyMask", A[A.UserSuppliedLayerMask = -2] = "UserSuppliedLayerMask", A[A.RealUserSuppliedLayerMask = -3] = "RealUserSuppliedLayerMask";
})(M || (M = {}));
function pn(A) {
  switch (A) {
    case M.Red:
      return 0;
    case M.Green:
      return 1;
    case M.Blue:
      return 2;
    case M.TransparencyMask:
      return 3;
    default:
      throw new xe();
  }
}
var $;
(function(A) {
  A[A.Other = 0] = "Other", A[A.OpenFolder = 1] = "OpenFolder", A[A.CloseFolder = 2] = "CloseFolder", A[A.BoundingSection = 3] = "BoundingSection";
})($ || ($ = {}));
function Nn(A) {
  if (A in $)
    return A;
  throw new Je();
}
var pA;
(function(A) {
  A[A.Vertical = 0] = "Vertical", A[A.Horizontal = 1] = "Horizontal";
})(pA || (pA = {}));
function Fn(A) {
  if (!(A in pA))
    throw new Te();
  return A;
}
var U;
(function(A) {
  A[A.GridAndGuides = 1032] = "GridAndGuides", A[A.Slices = 1050] = "Slices", A[A.ICCProfile = 1039] = "ICCProfile", A[A.GlobalLightAngle = 1037] = "GlobalLightAngle", A[A.GlobalLightAltitude = 1049] = "GlobalLightAltitude", A[A.ResolutionInfo = 1005] = "ResolutionInfo";
})(U || (U = {}));
var AA;
(function(A) {
  A[A.AutoGenerated = 0] = "AutoGenerated", A[A.LayerGenerated = 1] = "LayerGenerated", A[A.UserGenerated = 2] = "UserGenerated";
})(AA || (AA = {}));
function Gn(A) {
  if (!(A in AA))
    throw new ze(`Invalid slice origin: ${A}`);
  return A;
}
var HA;
(function(A) {
  A[A.PixelsPerInch = 1] = "PixelsPerInch", A[A.PixelsPerCM = 2] = "PixelsPerCM";
})(HA || (HA = {}));
var xA;
(function(A) {
  A[A.Inch = 1] = "Inch", A[A.CM = 2] = "CM", A[A.Point = 3] = "Point", A[A.Pica = 4] = "Pica", A[A.Column = 5] = "Column";
})(xA || (xA = {}));
var j;
(function(A) {
  A.Class = "Clss", A.Enumerated = "Enmr", A.Identifier = "Idnt", A.Index = "indx", A.Name = "name", A.Offset = "rele", A.Property = "prop";
})(j || (j = {}));
function jA(A, e = 255) {
  if (!(0 <= e && e <= 255))
    throw new Ke();
  const t = A.length / 4, n = pn(M.TransparencyMask), g = e / 255;
  for (let a = 0; a < t; a++) {
    const i = a * 4 + n;
    A[i] = Math.floor(g * A[i]);
  }
  return A;
}
let _A, OA, KA, PA, qA, ZA, Ie, Be, se, Qe, oe = (async () => {
  const A = "data:application/wasm;base64,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IAk2AgAMAwsQJgALIAZBARBMAAtBgIDAAEEZQaSAwAAQIAALIAooAgwhASAKKAIIIQQgAwRAIAIQBgsgACAENgIAIAAgATYCBCAKQRBqJAAPCxBHAAt5AQN/IwBBEGsiAiQAIAEoAgRFBEAgASgCDCEDIAJBCGoiBEEANgIAIAJCgICAgBA3AwAgAiACNgIMIAJBDGpBgIfAACADEAgaIAFBCGogBCgCADYCACABIAIpAwA3AgALIABBqInAADYCBCAAIAE2AgAgAkEQaiQAC10BAX8jAEEgayICJAAgACgCACEAIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAIgADYCBCACQQRqQaCFwAAgAkEIahAIIAJBIGokAAtdAQF/IwBBIGsiAiQAIAAoAgAhACACQRhqIAFBEGopAgA3AwAgAkEQaiABQQhqKQIANwMAIAIgASkCADcDCCACIAA2AgQgAkEEakGAh8AAIAJBCGoQCCACQSBqJAALVgEBfyMAQSBrIgIkACACIAA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakGghcAAIAJBCGoQCCACQSBqJAALZQEBfyMAQTBrIgMkACADIAE2AgwgAyAANgIIIANBHGpBATYCACADQSRqQQE2AgAgA0HIisAANgIYIANBADYCECADQSA2AiwgAyADQShqNgIgIAMgA0EIajYCKCADQRBqIAIQKQALUQEBfyMAQSBrIgIkACACQQxqQQE2AgAgAkEUakEANgIAIAJByIrAADYCECACQQA2AgAgAkErNgIcIAIgADYCGCACIAJBGGo2AgggAiABECkAC0YBAX8gAiAAKAIAIgAoAgAgACgCCCIDa0sEQCAAIAMgAhATIAAoAgghAwsgACgCBCADaiABIAIQThogACACIANqNgIIQQALQQEBfyACIAAoAgAgACgCCCIDa0sEQCAAIAMgAhATIAAoAgghAwsgACgCBCADaiABIAIQThogACACIANqNgIIQQAL6QQBBn8jAEEQayIDJABBgY3AAC0AAEEDRwRAIANBAToACyADIANBC2o2AgwgA0EMaiEAIwBBIGsiASQAAkACQAJAAkACQAJAAkBBgY3AAC0AAEEBaw4DAgQBAAtBgY3AAEECOgAAIAFBgY3AADYCCCAAKAIAIgAtAAAgAEEAOgAARQ0CIwBBIGsiACQAAkACQAJAQbiNwAAoAgBB/////wdxBEAQT0UNAQtBqI3AACgCAEGojcAAQX82AgANAQJAAkBBuI3AACgCAEH/////B3FFBEBBtI3AACgCACECQbSNwABBjIPAADYCAEGwjcAAKAIAIQRBsI3AAEEBNgIADAELEE9BtI3AACgCACECQbSNwABBjIPAADYCAEGwjcAAKAIAIQRBsI3AAEEBNgIARQ0BC0G4jcAAKAIAQf////8HcUUNABBPDQBBrI3AAEEBOgAAC0GojcAAQQA2AgACQCAERQ0AIAQgAigCABEEACACQQRqKAIARQ0AIAJBCGooAgAaIAQQBgsgAEEgaiQADAILIABBFGpBATYCACAAQRxqQQA2AgAgAEHUiMAANgIQIABBmIfAADYCGCAAQQA2AgggAEEIakH4iMAAECkACwALIAFBAzoADCABQQhqIgAoAgAgAC0ABDoAAAsgAUEgaiQADAQLIAFBFGpBATYCACABQRxqQQA2AgAgAUGQhMAANgIQDAILQZiEwABBkIXAABAhAAsgAUEUakEBNgIAIAFBHGpBADYCACABQdyDwAA2AhALIAFBoIXAADYCGCABQQA2AgggAUEIakHggsAAECkACwsgA0EQaiQACzgBAX8CQCABaUEBRw0AQYCAgIB4IAFrIABJIgINACAABEAgAEEAIAEgAhsQPCIBRQ0BCyABDwsAC0kBAX8jAEEgayIAJAAgAEEUakEBNgIAIABBHGpBADYCACAAQbCKwAA2AhAgAEGAisAANgIYIABBADYCCCAAQQhqQbiKwAAQKQALRAECfyABKAIEIQIgASgCACEDQQhBBBA8IgFFBEBBCEEEEEwACyABIAI2AgQgASADNgIAIABBuInAADYCBCAAIAE2AgALOQACQAJ/IAJBgIDEAEcEQEEBIAAgAiABKAIQEQAADQEaCyADDQFBAAsPCyAAIANBACABKAIMEQIAC7kCAQJ/IwBBIGsiAiQAIAJBAToAGCACIAE2AhQgAiAANgIQIAJBjIvAADYCDCACQciKwAA2AggjAEEQayIAJAACQCACQQhqIgEoAgwiAgRAIAEoAggiA0UNASAAIAI2AgggACABNgIEIAAgAzYCACMAQRBrIgEk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amogAkEwajoAAAsCfyAEQQlqIABqIQhBK0GAgMQAIAEoAhgiA0EBcSICGyEFIAJBJyAAayIJaiECQciKwABBACADQQRxGyEHAkACQCABKAIIRQRAQQEhACABKAIAIgMgAUEEaigCACICIAUgBxAoDQEMAgsCQAJAAkACQCACIAFBDGooAgAiBkkEQCADQQhxDQQgBiACayICIQNBASABLQAgIgAgAEEDRhsiAEEBaw4CAQIDC0EBIQAgASgCACIDIAFBBGooAgAiAiAFIAcQKA0EDAULQQAhAyACIQAMAQsgAkEBdiEAIAJBAWpBAXYhAwsgAEEBaiEAIAFBBGooAgAhAiABKAIcIQYgASgCACEBAkADQCAAQQFrIgBFDQEgASAGIAIoAhARAABFDQALQQEMBAtBASEAIAZBgIDEAEYNASABIAIgBSAHECgNASABIAggCSACKAIMEQIADQFBACEAAn8DQCADIAAgA0YNARogAEEBaiEAIAEgBiACKAIQEQAARQ0ACyAAQQFrCyADSSEADAELIAEoAhwhCyABQTA2AhwgAS0AICEMQQEhACABQQE6ACAgASgCACIDIAFBBGooAgAiCiAFIAcQKA0AIAYgAmtBAWohAAJAA0AgAEEBayIARQ0BIANBMCAKKAIQEQAARQ0AC0EBDAMLQQEhACADIAggCSAKKAIMEQIADQAgASAMOgAgIAEgCzYCHEEADAILIAAMAQsgAyAIIAkgAigCDBECAAsgBEEwaiQACwsAIAAjAGokACMACwwAQfCCwABBGRAEAAsKACAAKAIEQXhxCwoAIAAoAgRBAXELCgAgACgCDEEBcQsKACAAKAIMQQF2CxkAIAAgAUGkjcAAKAIAIgBBECAAGxEBAAALrwEBA38gASEFAkAgAkEPTQRAIAAhAQwBCyAAQQAgAGtBA3EiA2ohBCADBEAgACEBA0AgASAFOgAAIAFBAWoiASAESQ0ACwsgBCACIANrIgJBfHEiA2ohASADQQBKBEAgBUH/AXFBgYKECGwhAwNAIAQgAzYCACAEQQRqIgQgAUkNAAsLIAJBA3EhAgsgAgRAIAEgAmohAgNAIAEgBToAACABQQFqIgEgAkkNAAsLIAALswIBB38CQCACIgRBD00EQCAAIQIMAQsgAEEAIABrQQNxIgNqIQUgAwRAIAAhAiABIQYDQCAC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ADgAAABPbmNlIGluc3RhbmNlIGhhcyBwcmV2aW91c2x5IGJlZW4gcG9pc29uZWQAAOQBEAAqAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZS9ydXN0Yy85MGM1NDE4MDZmMjNhMTI3MDAyZGU1YjQwMzhiZTczMWJhMTQ1OGNhL2xpYnJhcnkvc3RkL3NyYy9zeW5jL29uY2UucnMAQwIQAEwAAACVAAAAMgAAAAUAAAAEAAAABAAAAAYAAAAHAAAACAAAAAkAAAAMAAAABAAAAAoAAAALAAAADAAAAGEgRGlzcGxheSBpbXBsZW1lbnRhdGlvbiByZXR1cm5lZCBhbiBlcnJvciB1bmV4cGVjdGVkbHkADQAAAAAAAAABAAAADgAAAC9ydXN0Yy85MGM1NDE4MDZmMjNhMTI3MDAyZGU1YjQwMzhiZTczMWJhMTQ1OGNhL2xpYnJhcnkvYWxsb2Mvc3JjL3N0cmluZy5ycwAYAxAASwAAAN0JAAAOAAAACgpTdGFjazoKCgAAEQAAAAQAAAAEAAAAEgAAABMAAAAUAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZW1lbW9yeSBhbGxvY2F0aW9uIG9mICBieXRlcyBmYWlsZWQAAADDAxAAFQAAANgDEAANAAAAbGlicmFyeS9zdGQvc3JjL2FsbG9jLnJz+AMQABgAAABVAQAACQAAAGNhbm5vdCBtb2RpZnkgdGhlIHBhbmljIGhvb2sgZnJvbSBhIHBhbmlja2luZyB0aHJlYWQgBBAANAAAAGxpYnJhcnkvc3RkL3NyYy9wYW5pY2tpbmcucnNcBBAAHAAAAIcAAAAJAAAAXAQQABwAAABBAgAAHgAAAFwEEAAcAAAAQAIAAB8AAAAVAAAADAAAAAQAAAAWAAAAEQAAAAgAAAAEAAAAFwAAABgAAAAQAAAABAAAABkAAAAaAAAAEQAAAAgAAAAEAAAAGwAAABwAAAARAAAAAAAAAAEAAAAdAAAAbGlicmFyeS9hbGxvYy9zcmMvcmF3X3ZlYy5yc2NhcGFjaXR5IG92ZXJmbG93AAAAHAUQABEAAAAABRAAHAAAAAwCAAAFAAAASAUQAAAAAAA6AAAASAUQAAAAAABQBRAAAQAAAFAFEAABAAAAcGFuaWNrZWQgYXQgJycsIHgFEAABAAAAeQUQAAMAAAAjAAAAAAAAAAEAAAAkAAAAOiAAAEgFEAAAAAAAnAUQAAIAAAAwMDAxMDIwMzA0MDUwNjA3MDgwOTEwMTExMjEzMTQxNTE2MTcxODE5MjAyMTIyMjMyNDI1MjYyNzI4MjkzMDMxMzIzMzM0MzUzNjM3MzgzOTQwNDE0MjQzNDQ0NTQ2NDc0ODQ5NTA1MTUyNTM1NDU1NTY1NzU4NTk2MDYxNjI2MzY0NjU2NjY3Njg2OTcwNzE3MjczNzQ3NTc2Nzc3ODc5ODA4MTgyODM4NDg1ODY4Nzg4ODk5MDkxOTI5Mzk0OTU5Njk3OTg5OUVycm9yAG8JcHJvZHVjZXJzAghsYW5ndWFnZQEEUnVzdAAMcHJvY2Vzc2VkLWJ5AwVydXN0Yx0xLjcwLjAgKDkwYzU0MTgwNiAyMDIzLTA1LTMxKQZ3YWxydXMGMC4xOS4wDHdhc20tYmluZGdlbgYwLjIuODcALA90YXJnZXRfZmVhdHVyZXMCKw9tdXRhYmxlLWdsb2JhbHMrCHNpZ24tZXh0", e = async (B = {}, C) => {
    let D;
    if (C.startsWith("data:")) {
      const l = C.replace(/^data:.*?base64,/, "");
      let y;
      if (typeof Buffer == "function" && typeof Buffer.from == "function")
        y = Buffer.from(l, "base64");
      else if (typeof atob == "function") {
        const F = atob(l);
        y = new Uint8Array(F.length);
        for (let h = 0; h < F.length; h++)
          y[h] = F.charCodeAt(h);
      } else
        throw new Error("Cannot decode base64-encoded data URL");
      D = await WebAssembly.instantiate(y, B);
    } else {
      const l = await fetch(C), y = l.headers.get("Content-Type") || "";
      if ("instantiateStreaming" in WebAssembly && y.startsWith("application/wasm"))
        D = await WebAssembly.instantiateStreaming(l, B);
      else {
        const F = await l.arrayBuffer();
        D = await WebAssembly.instantiate(F, B);
      }
    }
    return D.instance.exports;
  };
  let t;
  KA = function(B) {
    t = B;
  };
  const n = new Array(128).fill(void 0);
  n.push(void 0, null, !0, !1);
  function g(B) {
    return n[B];
  }
  let a = n.length;
  function i(B) {
    B < 132 || (n[B] = a, a = B);
  }
  function s(B) {
    const C = g(B);
    return i(B), C;
  }
  const I = typeof TextDecoder > "u" ? (0, module.require)("util").TextDecoder : TextDecoder;
  let Q = new I("utf-8", { ignoreBOM: !0, fatal: !0 });
  Q.decode();
  let r = null;
  function u() {
    return (r === null || r.byteLength === 0) && (r = new Uint8Array(t.memory.buffer)), r;
  }
  function L(B, C) {
    return B = B >>> 0, Q.decode(u().subarray(B, B + C));
  }
  let E = 0;
  function d(B, C) {
    const D = C(B.length * 1, 1) >>> 0;
    return u().set(B, D / 1), E = B.length, D;
  }
  let f = null;
  function k() {
    return (f === null || f.byteLength === 0) && (f = new Int32Array(t.memory.buffer)), f;
  }
  function R(B, C) {
    return B = B >>> 0, u().subarray(B / 1, B / 1 + C);
  }
  se = function(B, C, D, l, y, F, h) {
    try {
      const _ = t.__wbindgen_add_to_stack_pointer(-16), tA = d(C, t.__wbindgen_malloc), K = E, sA = d(l, t.__wbindgen_malloc), QA = E, oA = d(F, t.__wbindgen_malloc), rA = E;
      t.decode_rgb(_, B, tA, K, D, sA, QA, y, oA, rA, h);
      var p = k()[_ / 4 + 0], G = k()[_ / 4 + 1], T = R(p, G).slice();
      return t.__wbindgen_free(p, G * 1), T;
    } finally {
      t.__wbindgen_add_to_stack_pointer(16);
    }
  }, Qe = function(B, C, D, l, y, F, h, p, G) {
    try {
      const K = t.__wbindgen_add_to_stack_pointer(-16), sA = d(C, t.__wbindgen_malloc), QA = E, oA = d(l, t.__wbindgen_malloc), rA = E, ke = d(F, t.__wbindgen_malloc), pe = E, Ne = d(p, t.__wbindgen_malloc), Fe = E;
      t.decode_rgba(K, B, sA, QA, D, oA, rA, y, ke, pe, h, Ne, Fe, G);
      var T = k()[K / 4 + 0], _ = k()[K / 4 + 1], tA = R(T, _).slice();
      return t.__wbindgen_free(T, _ * 1), tA;
    } finally {
      t.__wbindgen_add_to_stack_pointer(16);
    }
  }, Ie = function(B, C, D) {
    try {
      const h = t.__wbindgen_add_to_stack_pointer(-16), p = d(C, t.__wbindgen_malloc), G = E;
      t.decode_grayscale(h, B, p, G, D);
      var l = k()[h / 4 + 0], y = k()[h / 4 + 1], F = R(l, y).slice();
      return t.__wbindgen_free(l, y * 1), F;
    } finally {
      t.__wbindgen_add_to_stack_pointer(16);
    }
  }, Be = function(B, C, D, l, y) {
    try {
      const G = t.__wbindgen_add_to_stack_pointer(-16), T = d(C, t.__wbindgen_malloc), _ = E, tA = d(l, t.__wbindgen_malloc), K = E;
      t.decode_grayscale_a(G, B, T, _, D, tA, K, y);
      var F = k()[G / 4 + 0], h = k()[G / 4 + 1], p = R(F, h).slice();
      return t.__wbindgen_free(F, h * 1), p;
    } finally {
      t.__wbindgen_add_to_stack_pointer(16);
    }
  };
  function b(B) {
    a === n.length && n.push(n.length + 1);
    const C = a;
    return a = n[C], n[C] = B, C;
  }
  const q = typeof TextEncoder > "u" ? (0, module.require)("util").TextEncoder : TextEncoder;
  let J = new q("utf-8");
  const gA = typeof J.encodeInto == "function" ? function(B, C) {
    return J.encodeInto(B, C);
  } : function(B, C) {
    const D = J.encode(B);
    return C.set(D), { read: B.length, written: D.length };
  };
  function x(B, C, D) {
    if (D === void 0) {
      const p = J.encode(B), G = C(p.length, 1) >>> 0;
      return u().subarray(G, G + p.length).set(p), E = p.length, G;
    }
    let l = B.length, y = C(l, 1) >>> 0;
    const F = u();
    let h = 0;
    for (; h < l; h++) {
      const p = B.charCodeAt(h);
      if (p > 127)
        break;
      F[y + h] = p;
    }
    if (h !== l) {
      h !== 0 && (B = B.slice(h)), y = D(y, l, l = h + B.length * 3, 1) >>> 0;
      const p = u().subarray(y + h, y + l), G = gA(B, p);
      h += G.written;
    }
    return E = h, y;
  }
  OA = function() {
    const B = new Error();
    return b(B);
  }, PA = function(B, C) {
    const D = g(C).stack, l = x(D, t.__wbindgen_malloc, t.__wbindgen_realloc), y = E;
    k()[B / 4 + 1] = y, k()[B / 4 + 0] = l;
  }, _A = function(B, C) {
    let D, l;
    try {
      D = B, l = C, console.error(L(B, C));
    } finally {
      t.__wbindgen_free(D, l, 1);
    }
  }, qA = function(B) {
    s(B);
  }, ZA = function(B, C) {
    throw new Error(L(B, C));
  }, URL = globalThis.URL;
  const N = await e({ "./webtoon_psd_decoder_bg.js": { __wbg_new_abda76e883ba8a5f: OA, __wbg_stack_658279fe44541cf6: PA, __wbg_error_f851667af71bcfc6: _A, __wbindgen_object_drop_ref: qA, __wbindgen_throw: ZA } }, A), Z = N.memory, BA = N.main_js, de = N.decode_rgb, le = N.decode_rgba, he = N.decode_grayscale, De = N.decode_grayscale_a, we = N.__wbindgen_add_to_stack_pointer, ue = N.__wbindgen_malloc, fe = N.__wbindgen_free, ye = N.__wbindgen_realloc, UA = N.__wbindgen_start, Se = Object.freeze(Object.defineProperty({ __proto__: null, __wbindgen_add_to_stack_pointer: we, __wbindgen_free: fe, __wbindgen_malloc: ue, __wbindgen_realloc: ye, __wbindgen_start: UA, decode_grayscale: he, decode_grayscale_a: De, decode_rgb: de, decode_rgba: le, main_js: BA, memory: Z }, Symbol.toStringTag, { value: "Module" }));
  KA(Se), UA();
})();
async function Ln(A, e, t, n, g, a) {
  const i = A * e;
  if (!(i > 0 && Number.isInteger(i)))
    throw new Error(`Pixel count must be a positive integer, got ${i}`);
  let s;
  if (n && g)
    s = await Mn(i, t, n, g, a);
  else if (!g && !n)
    s = await NA(i, t, a);
  else
    throw new Error(`Missing ${g ? "green" : "blue"} channel in RGB image`);
  return new Uint8ClampedArray(s.buffer, s.byteOffset, s.byteLength);
}
function W(A) {
  switch (A) {
    case H.RawData:
    case H.RleCompressed:
      return;
  }
  throw new WA(`Unsupported compression method: ${A}`);
}
async function Mn(A, e, t, n, g) {
  return await oe, W(e.compression), W(n.compression), W(e.compression), g && W(g.compression), g ? Qe(A, e.data, e.compression, t.data, t.compression, n.data, n.compression, g.data, g.compression) : se(A, e.data, e.compression, t.data, t.compression, n.data, n.compression);
}
async function NA(A, e, t) {
  return await oe, W(e.compression), t && W(t.compression), t ? Be(A, e.data, e.compression, t.data, t.compression) : Ie(A, e.data, e.compression);
}
function Rn(A) {
  const e = fn(A), { fileHeader: t } = e, n = RA(t.version), g = Gt(e.imageResources), a = wn(e.layerAndMaskInformation, n), i = yt(e.imageData, t.depth, t.height, t.channelCount, n);
  return {
    fileHeader: t,
    colorModeData: void 0,
    imageResources: g,
    layerAndMaskInfo: a,
    imageData: i
  };
}
function IA(A) {
  const e = A.readUnicodeString(0), t = A.readIdString(), n = A.read("u32"), g = /* @__PURE__ */ new Map();
  for (; g.size < n; ) {
    const a = A.readIdString(), i = FA(A);
    if (g.has(a))
      throw new et(`Duplicate descriptor key: ${a}`);
    g.set(a, i);
  }
  return { name: e, classId: t, items: g };
}
function m(A) {
  const e = A.read("u32");
  if (e !== 16)
    throw new At(`Invalid descriptor version: ${e}`);
  const t = IA(A);
  return { descriptorVersion: e, descriptor: t };
}
function FA(A) {
  const e = A.readString(4);
  switch (e) {
    case c.Alias: {
      const t = A.read("u32"), n = A.take(t);
      return { type: e, data: n };
    }
    case c.Boolean: {
      const t = !!A.read("u8");
      return { type: e, value: t };
    }
    case c.Class:
    case c.GlobalClass: {
      const t = A.readUnicodeString(0), n = A.readIdString();
      return { type: e, name: t, classId: n };
    }
    case c.Descriptor:
    case c.GlobalObject: {
      const t = IA(A);
      return { type: e, descriptor: t };
    }
    case c.Double: {
      const t = A.read("f64");
      return { type: e, value: t };
    }
    case c.Enumerated: {
      const t = A.readIdString(), n = A.readIdString();
      return { type: e, enumType: t, enumValue: n };
    }
    case c.Integer: {
      const t = A.read("i32");
      return { type: e, value: t };
    }
    case c.LargeInteger: {
      const t = A.read("i64");
      return { type: e, value: t };
    }
    case c.List: {
      const t = A.read("u32"), n = [];
      for (; n.length < t; )
        n.push(FA(A));
      return { type: e, values: n };
    }
    case c.RawData: {
      const t = A.read("u32"), n = A.take(t);
      return { type: e, data: n };
    }
    case c.Reference: {
      const t = A.read("u32"), n = [];
      for (; n.length < t; )
        n.push(Un(A));
      return { type: e, references: n };
    }
    case c.String: {
      const t = A.readUnicodeString(0);
      return { type: e, value: t };
    }
    case c.UnitFloat: {
      const t = TA(A.readString(4)), n = A.read("f64");
      return { type: e, unitType: t, value: n };
    }
    case c.ObjectArray: {
      A.read("u32");
      const t = A.readUnicodeString(0), n = A.readIdString(), g = A.read("u32"), a = Array.from(Array(g), () => {
        const i = A.readIdString(), s = FA(A);
        return { key: i, value: s };
      });
      return { type: e, classObj: { name: t, classId: n }, items: a };
    }
    case c.UnitFloats: {
      const t = TA(A.readString(4)), n = A.read("u32"), g = Array.from(Array(n), () => A.read("f64"));
      return { type: e, unitType: t, values: g };
    }
    default:
      throw new $e(`Unexpected descriptor type: ${e}`);
  }
}
function Un(A) {
  const e = A.readString(4);
  switch (e) {
    case j.Class: {
      const t = A.readUnicodeString(0), n = A.readIdString();
      return { type: e, name: t, classId: n };
    }
    case j.Enumerated: {
      const t = A.readUnicodeString(0), n = A.readIdString(), g = A.readIdString(), a = A.readIdString();
      return { type: e, name: t, classId: n, typeId: g, enumValue: a };
    }
    case j.Identifier: {
      const t = A.readString(4);
      return { type: e, identifier: t };
    }
    case j.Index: {
      const t = A.read("u32");
      return { type: e, index: t };
    }
    case j.Name: {
      const t = A.readUnicodeString(0);
      return { type: e, name: t };
    }
    case j.Offset: {
      const t = A.readUnicodeString(0), n = A.readIdString(), g = A.read("u32");
      return { type: e, name: t, classId: n, offset: g };
    }
    case j.Property: {
      const t = A.readUnicodeString(0), n = A.readIdString(), g = A.readIdString();
      return { type: e, name: t, classId: n, keyId: g };
    }
    default:
      throw new gt(`Invalid reference type: ${e}`);
  }
}
function TA(A) {
  if (!Object.values(SA).includes(A))
    throw new at(`Invalid Unit Float type: ${A}`);
  return A;
}
var S;
(function(A) {
  A[A.String = 0] = "String", A[A.DictBeg = 1] = "DictBeg", A[A.DictEnd = 2] = "DictEnd", A[A.ArrBeg = 3] = "ArrBeg", A[A.ArrEnd = 4] = "ArrEnd", A[A.Name = 5] = "Name", A[A.Number = 6] = "Number", A[A.Boolean = 7] = "Boolean";
})(S || (S = {}));
const GA = /* @__PURE__ */ new Set([
  0,
  9,
  12,
  32,
  10,
  13
  // \r
]), bn = /* @__PURE__ */ new Set([
  102,
  116
  // t
]), v = {
  "(": 40,
  ")": 41,
  "<": 60,
  ">": 62,
  "[": 91,
  "]": 93,
  "/": 47,
  "\\": 92
  // NOTE: These have meaning within PDF. Are they used here?
  // "{": 123,
  // "}": 125,
  // "%": 37,
}, re = new Set(Object.values(v)), Ce = [];
for (let A = 0; A < 256; A += 1)
  Ce[A] = GA.has(A) || re.has(A);
const Yn = new TextDecoder("utf-8");
function mn(A) {
  const e = A.position;
  let t = A.position;
  for (const g of A.iter()) {
    if (Ce[g])
      break;
    t += 1;
  }
  return Yn.decode(A.take(t - e));
}
class Jn {
  constructor(e) {
    this.cursor = O.from(e);
  }
  tokens() {
    const e = [];
    for (; !this.done(); ) {
      const t = this.cursor.one();
      if (GA.has(t)) {
        for (; !this.done() && GA.has(this.cursor.peek()); )
          this.cursor.pass(1);
        continue;
      }
      if (re.has(t)) {
        if (t === v["("]) {
          e.push({ type: S.String, value: this.text() });
          continue;
        }
        if (t === v["["]) {
          e.push({ type: S.ArrBeg });
          continue;
        }
        if (t === v["]"]) {
          e.push({ type: S.ArrEnd });
          continue;
        }
        if (t === v["<"]) {
          this.cursor.pass(1), e.push({ type: S.DictBeg });
          continue;
        }
        if (t === v[">"]) {
          this.cursor.pass(1), e.push({ type: S.DictEnd });
          continue;
        }
        if (t === v["/"]) {
          e.push({ type: S.Name, value: this.string() });
          continue;
        }
        console.assert(!1, "Unhandled delimiter: '%s'", String.fromCharCode(t));
        continue;
      }
      this.cursor.unpass(1), bn.has(t) ? e.push({ type: S.Boolean, value: this.boolean() }) : e.push({ type: S.Number, value: this.number() });
    }
    return e;
  }
  done() {
    return this.cursor.position >= this.cursor.length;
  }
  text() {
    const e = this.cursor.peek();
    if (e === v[")"])
      return this.cursor.pass(1), "";
    const t = e === 255 || e === 254;
    let n = new TextDecoder("utf-16be");
    t && (n = this.textDecoderFromBOM());
    const g = [], a = this.cursor.clone();
    for (; a.peek() !== v[")"]; )
      if (a.pass(1), a.peek() === v["\\"]) {
        const I = a.position - this.cursor.position;
        g.push(n.decode(this.cursor.take(I), { stream: !0 })), a.pass(2), this.cursor.pass(1), g.push(n.decode(this.cursor.take(1), { stream: !0 }));
      }
    const i = a.position - this.cursor.position, s = this.cursor.take(i);
    return g.push(n.decode(s)), this.cursor.pass(1), g.join("");
  }
  textDecoderFromBOM() {
    const e = this.cursor.one(), t = this.cursor.one();
    if (e === 255 && t === 254)
      return new TextDecoder("utf-16le");
    if (e === 254 && t === 255)
      return new TextDecoder("utf-16be");
    throw new st(`Unknown BOM value: [${e}, ${t}]`);
  }
  string() {
    return mn(this.cursor);
  }
  number() {
    const e = this.string(), t = Number(e);
    if (Number.isNaN(t))
      throw new It(`parsing '${e}' as Number failed`);
    return t;
  }
  boolean() {
    const e = this.string();
    if (e === "true")
      return !0;
    if (e === "false")
      return !1;
    throw new it(`'${e}' is neither 'true' nor 'false'`);
  }
}
const hA = Symbol(S[S.ArrBeg]), DA = Symbol(S[S.DictBeg]);
class vn {
  constructor(e) {
    this.tokens = e, this.stack = [];
  }
  parse() {
    this.runParser();
    const [e] = this.stack;
    if (typeof e == "object" && !Array.isArray(e))
      return e;
    throw new Bt(`EngineData top-level value is not a dict; is ${typeof e}`);
  }
  runParser() {
    for (const e of this.tokens)
      switch (e.type) {
        case S.Name:
        case S.Number:
        case S.Boolean:
        case S.String:
          this.stack.push(e.value);
          continue;
        case S.DictBeg:
          this.stack.push(DA);
          continue;
        case S.ArrBeg:
          this.stack.push(hA);
          continue;
        case S.DictEnd:
          this.stack.push(this.dict());
          continue;
        case S.ArrEnd:
          this.stack.push(this.array().reverse());
          continue;
      }
  }
  dict() {
    const e = {};
    for (; ; ) {
      const t = this.stack.pop();
      if (t === void 0)
        throw new YA("Stack empty when parsing dict");
      if (t === DA)
        return e;
      if (t === hA)
        throw new EA("Got ArrBeg while parsing a dict");
      const n = this.stack.pop();
      if (typeof n != "string")
        throw new EA(`Dict key is not Name; is ${typeof n}`);
      e[n] = t;
    }
  }
  array() {
    const e = [];
    for (; ; ) {
      const t = this.stack.pop();
      if (t === void 0)
        throw new YA("Stack empty when parsing array");
      if (t === DA)
        throw new EA("Got DictBeg while parsing array");
      if (t === hA)
        return e;
      e.push(t);
    }
  }
}
const Hn = /* @__PURE__ */ new Set([
  "DocumentResources",
  "EngineDict",
  "ResourceDict"
]);
function xn(A, e) {
  return Object.prototype.hasOwnProperty.call(A, e);
}
function jn(A) {
  let e = !0;
  if (typeof A != "object" || !A)
    return !1;
  for (const t of Hn)
    if (xn(A, t)) {
      const n = A[t];
      e = e && typeof n == "object" && !Array.isArray(n) && !!n;
    } else
      return !1;
  return e;
}
function _n(A) {
  const e = new vn(new Jn(A).tokens()).parse();
  if (jn(e))
    return e;
  throw new Qt(`Object with keys ${JSON.stringify(Object.keys(e))} is not valid EngineData`);
}
class Ee {
  async composite(e = !0, t = !0) {
    const { red: n, green: g, blue: a, alpha: i } = this.imageData, { width: s, height: I } = this, Q = await Ln(s, I, n, g, a, i);
    if (e === !0)
      if (t === !0) {
        const r = this.composedOpacity * 255;
        return jA(Q, r);
      } else
        return jA(Q, this.opacity);
    return Q;
  }
}
class On extends Ee {
  /** @internal */
  constructor(e, t) {
    super(), this.layerFrame = e, this.parent = t, this.type = "Layer";
  }
  get name() {
    return this.layerFrame.layerProperties.name;
  }
  get width() {
    return this.layerFrame.width;
  }
  get height() {
    return this.layerFrame.height;
  }
  get top() {
    return this.layerFrame.layerProperties.top;
  }
  get left() {
    return this.layerFrame.layerProperties.left;
  }
  get opacity() {
    return this.layerFrame.layerProperties.opacity;
  }
  get composedOpacity() {
    return this.parent.composedOpacity * (this.opacity / 255);
  }
  get maskData() {
    return this.layerFrame.layerProperties.maskData;
  }
  async userMask() {
    const e = this.layerFrame.userMask;
    if (e)
      return NA(mA(this.maskData), e);
  }
  async realUserMask() {
    const e = this.maskData.realData, t = this.layerFrame.realUserMask;
    if (!(!e || !t))
      return NA(mA(e), t);
  }
  get isHidden() {
    return this.layerFrame.layerProperties.hidden;
  }
  get isTransparencyLocked() {
    return this.layerFrame.layerProperties.transparencyLocked;
  }
  get additionalProperties() {
    return this.layerFrame.layerProperties.additionalLayerProperties;
  }
  /**
   * If this layer is a text layer, this property retrieves its text content.
   * Otherwise, this property is `undefined`.
   */
  get text() {
    return this.layerFrame.layerProperties.text;
  }
  /**
   * If this layer is a text layer, this property retrieves its text properties.
   * Otherwise, this property is `undefined`.
   */
  get textProperties() {
    return this.layerFrame.layerProperties.textProperties;
  }
  get imageData() {
    const { red: e, green: t, blue: n, alpha: g } = this.layerFrame;
    return { red: e, green: t, blue: n, alpha: g };
  }
}
function Kn(A) {
  return A.type === "Psd" || A.type === "Group";
}
function VA(A) {
  if (!Kn(A))
    throw new o(`Node (name = '${A.name}', type: '${A.type}') cannot be a parent node`);
}
class Pn {
  constructor(e, t, n, g, a) {
    this.origin = e, this.left = t, this.top = n, this.right = g, this.bottom = a;
  }
}
function qn(A) {
  if (A.resource.descriptor) {
    const e = A.resource.descriptor.descriptor.items.get("slices");
    if (!(e && e.type === c.List))
      throw new nA('Missing key "slices" in slice descriptor');
    return e.values.reduce((t, n) => {
      if (n.type !== c.Descriptor)
        throw new nA(`Slice list contains a non-descriptor (type: ${n.type})`);
      return t.push(Zn(n.descriptor)), t;
    }, []);
  } else
    throw new nA("No slice descriptor in slice resource block");
}
function Zn(A) {
  const e = Tn(A), t = V(A, "bounds", c.Descriptor).descriptor, n = V(t, "Top ", c.Integer).value, g = V(t, "Left", c.Integer).value, a = V(t, "Btom", c.Integer).value, i = V(t, "Rght", c.Integer).value;
  return new Pn(e, g, n, i, a);
}
function Tn(A) {
  const e = V(A, "origin", c.Enumerated);
  if (e.enumType !== "ESliceOrigin")
    throw new nA(`Unexpected enum type for slice origin: got "${e.enumType}"`);
  switch (e.enumValue) {
    case "layerGenerated":
      return AA.LayerGenerated;
    case "userGenerated":
      return AA.UserGenerated;
    case "autoGenerated":
      return AA.AutoGenerated;
    default:
      throw new nA(`Unexpected enum value for slice origin: got "${e.enumValue}"`);
  }
}
class ce extends Ee {
  static parse(e) {
    const t = Rn(e);
    return new ce(t);
  }
  /** @internal */
  constructor(e) {
    super(), this.parsingResult = e, this.name = "ROOT", this.type = "Psd", this.opacity = 255, this.composedOpacity = 1, this.children = [], this.layers = [], this.guides = [], this.slices = [], this.icc_profile = void 0, this.globalLightAngle = void 0, this.globalLightAltitude = void 0, this.resolutionInfo = void 0, this.additionalLayerProperties = {}, this.buildTreeStructure(), this.additionalLayerProperties = e.layerAndMaskInfo.globalAdditionalLayerInformation;
    for (const t of e.imageResources.resources)
      if (t.resource !== null)
        switch (t.id) {
          case U.GridAndGuides:
            this.guides = t.resource.guides;
            break;
          case U.Slices:
            this.slices = qn(t);
            break;
          case U.ICCProfile:
            this.icc_profile = t.resource;
            break;
          case U.GlobalLightAltitude:
            this.globalLightAltitude = t.resource;
            break;
          case U.GlobalLightAngle:
            this.globalLightAngle = t.resource;
            break;
          case U.ResolutionInfo:
            this.resolutionInfo = t.resource;
            break;
        }
  }
  get width() {
    return this.parsingResult.fileHeader.width;
  }
  get height() {
    return this.parsingResult.fileHeader.height;
  }
  get channelCount() {
    return this.parsingResult.fileHeader.channelCount;
  }
  get depth() {
    return this.parsingResult.fileHeader.depth;
  }
  get colorMode() {
    return this.parsingResult.fileHeader.colorMode;
  }
  get imageData() {
    const { compression: e, red: t, green: n, blue: g, alpha: a } = this.parsingResult.imageData;
    return {
      red: { compression: e, data: t },
      green: n ? { compression: e, data: n } : void 0,
      blue: g ? { compression: e, data: g } : void 0,
      alpha: a ? { compression: e, data: a } : void 0
    };
  }
  buildTreeStructure() {
    const { groups: e, layers: t, orders: n } = this.parsingResult.layerAndMaskInfo, g = [this];
    let a = 0, i = 0;
    n.forEach((s) => {
      const I = g[g.length - 1];
      switch (s) {
        case "G": {
          const Q = e[a];
          VA(I);
          const r = new Ge(Q, I);
          g.push(r), I.children.push(r), a += 1;
          break;
        }
        case "L": {
          const Q = t[i];
          VA(I);
          const r = new On(Q, I);
          this.layers.push(r), I.children.push(r), i += 1;
          break;
        }
        case "D":
          g.pop();
      }
    }), g.length = 0, this.children.forEach((s) => {
      var I, Q;
      return (Q = (I = s).freeze) === null || Q === void 0 ? void 0 : Q.call(I);
    }), Object.freeze(this.children);
  }
}
export {
  w as AliKey,
  fA as ColorMode,
  yA as Depth,
  xA as DimensionUnit,
  pA as GuideDirection,
  Y as PathRecordType,
  HA as ResolutionUnit,
  AA as SliceOrigin,
  ce as default
};
//# sourceMappingURL=index.js.map
