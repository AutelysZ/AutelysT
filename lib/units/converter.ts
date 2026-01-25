// Unit Converter Library - Comprehensive unit conversion support

export type UnitCategory =
  | "length"
  | "mass"
  | "volume"
  | "area"
  | "temperature"
  | "time"
  | "speed"
  | "pressure"
  | "energy"
  | "power"
  | "data"
  | "angle"
  | "frequency"
  | "force"
  | "fuel"
  | "cooking";

export interface UnitDefinition {
  id: string;
  name: string;
  symbol: string;
  toBase: (value: number) => number; // Convert to base unit
  fromBase: (value: number) => number; // Convert from base unit
}

export interface UnitCategoryDefinition {
  id: UnitCategory;
  name: string;
  baseUnit: string;
  units: UnitDefinition[];
}

// Length units (base: meter)
const lengthUnits: UnitDefinition[] = [
  { id: "m", name: "Meter", symbol: "m", toBase: (v) => v, fromBase: (v) => v },
  {
    id: "km",
    name: "Kilometer",
    symbol: "km",
    toBase: (v) => v * 1000,
    fromBase: (v) => v / 1000,
  },
  {
    id: "cm",
    name: "Centimeter",
    symbol: "cm",
    toBase: (v) => v / 100,
    fromBase: (v) => v * 100,
  },
  {
    id: "mm",
    name: "Millimeter",
    symbol: "mm",
    toBase: (v) => v / 1000,
    fromBase: (v) => v * 1000,
  },
  {
    id: "um",
    name: "Micrometer",
    symbol: "um",
    toBase: (v) => v / 1e6,
    fromBase: (v) => v * 1e6,
  },
  {
    id: "nm",
    name: "Nanometer",
    symbol: "nm",
    toBase: (v) => v / 1e9,
    fromBase: (v) => v * 1e9,
  },
  {
    id: "mi",
    name: "Mile",
    symbol: "mi",
    toBase: (v) => v * 1609.344,
    fromBase: (v) => v / 1609.344,
  },
  {
    id: "yd",
    name: "Yard",
    symbol: "yd",
    toBase: (v) => v * 0.9144,
    fromBase: (v) => v / 0.9144,
  },
  {
    id: "ft",
    name: "Foot",
    symbol: "ft",
    toBase: (v) => v * 0.3048,
    fromBase: (v) => v / 0.3048,
  },
  {
    id: "in",
    name: "Inch",
    symbol: "in",
    toBase: (v) => v * 0.0254,
    fromBase: (v) => v / 0.0254,
  },
  {
    id: "nmi",
    name: "Nautical Mile",
    symbol: "nmi",
    toBase: (v) => v * 1852,
    fromBase: (v) => v / 1852,
  },
  {
    id: "ly",
    name: "Light Year",
    symbol: "ly",
    toBase: (v) => v * 9.461e15,
    fromBase: (v) => v / 9.461e15,
  },
  {
    id: "au",
    name: "Astronomical Unit",
    symbol: "AU",
    toBase: (v) => v * 1.496e11,
    fromBase: (v) => v / 1.496e11,
  },
  {
    id: "pc",
    name: "Parsec",
    symbol: "pc",
    toBase: (v) => v * 3.086e16,
    fromBase: (v) => v / 3.086e16,
  },
  {
    id: "angstrom",
    name: "Angstrom",
    symbol: "A",
    toBase: (v) => v * 1e-10,
    fromBase: (v) => v / 1e-10,
  },
  {
    id: "fathom",
    name: "Fathom",
    symbol: "fth",
    toBase: (v) => v * 1.8288,
    fromBase: (v) => v / 1.8288,
  },
  {
    id: "furlong",
    name: "Furlong",
    symbol: "fur",
    toBase: (v) => v * 201.168,
    fromBase: (v) => v / 201.168,
  },
  {
    id: "chain",
    name: "Chain",
    symbol: "ch",
    toBase: (v) => v * 20.1168,
    fromBase: (v) => v / 20.1168,
  },
];

// Mass units (base: kilogram)
const massUnits: UnitDefinition[] = [
  {
    id: "kg",
    name: "Kilogram",
    symbol: "kg",
    toBase: (v) => v,
    fromBase: (v) => v,
  },
  {
    id: "g",
    name: "Gram",
    symbol: "g",
    toBase: (v) => v / 1000,
    fromBase: (v) => v * 1000,
  },
  {
    id: "mg",
    name: "Milligram",
    symbol: "mg",
    toBase: (v) => v / 1e6,
    fromBase: (v) => v * 1e6,
  },
  {
    id: "ug",
    name: "Microgram",
    symbol: "ug",
    toBase: (v) => v / 1e9,
    fromBase: (v) => v * 1e9,
  },
  {
    id: "t",
    name: "Metric Ton",
    symbol: "t",
    toBase: (v) => v * 1000,
    fromBase: (v) => v / 1000,
  },
  {
    id: "lb",
    name: "Pound",
    symbol: "lb",
    toBase: (v) => v * 0.453592,
    fromBase: (v) => v / 0.453592,
  },
  {
    id: "oz",
    name: "Ounce",
    symbol: "oz",
    toBase: (v) => v * 0.0283495,
    fromBase: (v) => v / 0.0283495,
  },
  {
    id: "st",
    name: "Stone",
    symbol: "st",
    toBase: (v) => v * 6.35029,
    fromBase: (v) => v / 6.35029,
  },
  {
    id: "ton_us",
    name: "US Ton",
    symbol: "ton",
    toBase: (v) => v * 907.185,
    fromBase: (v) => v / 907.185,
  },
  {
    id: "ton_uk",
    name: "UK Ton",
    symbol: "ton",
    toBase: (v) => v * 1016.05,
    fromBase: (v) => v / 1016.05,
  },
  {
    id: "carat",
    name: "Carat",
    symbol: "ct",
    toBase: (v) => v * 0.0002,
    fromBase: (v) => v / 0.0002,
  },
  {
    id: "grain",
    name: "Grain",
    symbol: "gr",
    toBase: (v) => v * 6.47989e-5,
    fromBase: (v) => v / 6.47989e-5,
  },
  {
    id: "dram",
    name: "Dram",
    symbol: "dr",
    toBase: (v) => v * 0.00177185,
    fromBase: (v) => v / 0.00177185,
  },
  {
    id: "slug",
    name: "Slug",
    symbol: "slug",
    toBase: (v) => v * 14.5939,
    fromBase: (v) => v / 14.5939,
  },
];

// Volume units (base: liter)
const volumeUnits: UnitDefinition[] = [
  { id: "l", name: "Liter", symbol: "L", toBase: (v) => v, fromBase: (v) => v },
  {
    id: "ml",
    name: "Milliliter",
    symbol: "mL",
    toBase: (v) => v / 1000,
    fromBase: (v) => v * 1000,
  },
  {
    id: "cl",
    name: "Centiliter",
    symbol: "cL",
    toBase: (v) => v / 100,
    fromBase: (v) => v * 100,
  },
  {
    id: "dl",
    name: "Deciliter",
    symbol: "dL",
    toBase: (v) => v / 10,
    fromBase: (v) => v * 10,
  },
  {
    id: "m3",
    name: "Cubic Meter",
    symbol: "m3",
    toBase: (v) => v * 1000,
    fromBase: (v) => v / 1000,
  },
  {
    id: "cm3",
    name: "Cubic Centimeter",
    symbol: "cm3",
    toBase: (v) => v / 1000,
    fromBase: (v) => v * 1000,
  },
  {
    id: "mm3",
    name: "Cubic Millimeter",
    symbol: "mm3",
    toBase: (v) => v / 1e6,
    fromBase: (v) => v * 1e6,
  },
  {
    id: "gal_us",
    name: "US Gallon",
    symbol: "gal",
    toBase: (v) => v * 3.78541,
    fromBase: (v) => v / 3.78541,
  },
  {
    id: "gal_uk",
    name: "UK Gallon",
    symbol: "gal",
    toBase: (v) => v * 4.54609,
    fromBase: (v) => v / 4.54609,
  },
  {
    id: "qt_us",
    name: "US Quart",
    symbol: "qt",
    toBase: (v) => v * 0.946353,
    fromBase: (v) => v / 0.946353,
  },
  {
    id: "pt_us",
    name: "US Pint",
    symbol: "pt",
    toBase: (v) => v * 0.473176,
    fromBase: (v) => v / 0.473176,
  },
  {
    id: "cup_us",
    name: "US Cup",
    symbol: "cup",
    toBase: (v) => v * 0.236588,
    fromBase: (v) => v / 0.236588,
  },
  {
    id: "floz_us",
    name: "US Fluid Ounce",
    symbol: "fl oz",
    toBase: (v) => v * 0.0295735,
    fromBase: (v) => v / 0.0295735,
  },
  {
    id: "floz_uk",
    name: "UK Fluid Ounce",
    symbol: "fl oz",
    toBase: (v) => v * 0.0284131,
    fromBase: (v) => v / 0.0284131,
  },
  {
    id: "tbsp",
    name: "Tablespoon",
    symbol: "tbsp",
    toBase: (v) => v * 0.0147868,
    fromBase: (v) => v / 0.0147868,
  },
  {
    id: "tsp",
    name: "Teaspoon",
    symbol: "tsp",
    toBase: (v) => v * 0.00492892,
    fromBase: (v) => v / 0.00492892,
  },
  {
    id: "bbl",
    name: "Barrel (Oil)",
    symbol: "bbl",
    toBase: (v) => v * 158.987,
    fromBase: (v) => v / 158.987,
  },
  {
    id: "ft3",
    name: "Cubic Foot",
    symbol: "ft3",
    toBase: (v) => v * 28.3168,
    fromBase: (v) => v / 28.3168,
  },
  {
    id: "in3",
    name: "Cubic Inch",
    symbol: "in3",
    toBase: (v) => v * 0.0163871,
    fromBase: (v) => v / 0.0163871,
  },
];

// Area units (base: square meter)
const areaUnits: UnitDefinition[] = [
  {
    id: "m2",
    name: "Square Meter",
    symbol: "m2",
    toBase: (v) => v,
    fromBase: (v) => v,
  },
  {
    id: "km2",
    name: "Square Kilometer",
    symbol: "km2",
    toBase: (v) => v * 1e6,
    fromBase: (v) => v / 1e6,
  },
  {
    id: "cm2",
    name: "Square Centimeter",
    symbol: "cm2",
    toBase: (v) => v / 1e4,
    fromBase: (v) => v * 1e4,
  },
  {
    id: "mm2",
    name: "Square Millimeter",
    symbol: "mm2",
    toBase: (v) => v / 1e6,
    fromBase: (v) => v * 1e6,
  },
  {
    id: "ha",
    name: "Hectare",
    symbol: "ha",
    toBase: (v) => v * 1e4,
    fromBase: (v) => v / 1e4,
  },
  {
    id: "acre",
    name: "Acre",
    symbol: "ac",
    toBase: (v) => v * 4046.86,
    fromBase: (v) => v / 4046.86,
  },
  {
    id: "mi2",
    name: "Square Mile",
    symbol: "mi2",
    toBase: (v) => v * 2.59e6,
    fromBase: (v) => v / 2.59e6,
  },
  {
    id: "yd2",
    name: "Square Yard",
    symbol: "yd2",
    toBase: (v) => v * 0.836127,
    fromBase: (v) => v / 0.836127,
  },
  {
    id: "ft2",
    name: "Square Foot",
    symbol: "ft2",
    toBase: (v) => v * 0.092903,
    fromBase: (v) => v / 0.092903,
  },
  {
    id: "in2",
    name: "Square Inch",
    symbol: "in2",
    toBase: (v) => v * 0.00064516,
    fromBase: (v) => v / 0.00064516,
  },
  {
    id: "are",
    name: "Are",
    symbol: "a",
    toBase: (v) => v * 100,
    fromBase: (v) => v / 100,
  },
];

// Temperature units (special handling - not linear)
const temperatureUnits: UnitDefinition[] = [
  {
    id: "c",
    name: "Celsius",
    symbol: "C",
    toBase: (v) => v,
    fromBase: (v) => v,
  },
  {
    id: "f",
    name: "Fahrenheit",
    symbol: "F",
    toBase: (v) => (v - 32) * (5 / 9),
    fromBase: (v) => v * (9 / 5) + 32,
  },
  {
    id: "k",
    name: "Kelvin",
    symbol: "K",
    toBase: (v) => v - 273.15,
    fromBase: (v) => v + 273.15,
  },
  {
    id: "r",
    name: "Rankine",
    symbol: "R",
    toBase: (v) => (v - 491.67) * (5 / 9),
    fromBase: (v) => (v + 273.15) * (9 / 5),
  },
];

// Time units (base: second)
const timeUnits: UnitDefinition[] = [
  {
    id: "s",
    name: "Second",
    symbol: "s",
    toBase: (v) => v,
    fromBase: (v) => v,
  },
  {
    id: "ms",
    name: "Millisecond",
    symbol: "ms",
    toBase: (v) => v / 1000,
    fromBase: (v) => v * 1000,
  },
  {
    id: "us",
    name: "Microsecond",
    symbol: "us",
    toBase: (v) => v / 1e6,
    fromBase: (v) => v * 1e6,
  },
  {
    id: "ns",
    name: "Nanosecond",
    symbol: "ns",
    toBase: (v) => v / 1e9,
    fromBase: (v) => v * 1e9,
  },
  {
    id: "min",
    name: "Minute",
    symbol: "min",
    toBase: (v) => v * 60,
    fromBase: (v) => v / 60,
  },
  {
    id: "h",
    name: "Hour",
    symbol: "h",
    toBase: (v) => v * 3600,
    fromBase: (v) => v / 3600,
  },
  {
    id: "d",
    name: "Day",
    symbol: "d",
    toBase: (v) => v * 86400,
    fromBase: (v) => v / 86400,
  },
  {
    id: "wk",
    name: "Week",
    symbol: "wk",
    toBase: (v) => v * 604800,
    fromBase: (v) => v / 604800,
  },
  {
    id: "mo",
    name: "Month (30d)",
    symbol: "mo",
    toBase: (v) => v * 2592000,
    fromBase: (v) => v / 2592000,
  },
  {
    id: "yr",
    name: "Year (365d)",
    symbol: "yr",
    toBase: (v) => v * 31536000,
    fromBase: (v) => v / 31536000,
  },
  {
    id: "decade",
    name: "Decade",
    symbol: "dec",
    toBase: (v) => v * 315360000,
    fromBase: (v) => v / 315360000,
  },
  {
    id: "century",
    name: "Century",
    symbol: "c",
    toBase: (v) => v * 3153600000,
    fromBase: (v) => v / 3153600000,
  },
];

// Speed units (base: meter per second)
const speedUnits: UnitDefinition[] = [
  {
    id: "mps",
    name: "Meter/Second",
    symbol: "m/s",
    toBase: (v) => v,
    fromBase: (v) => v,
  },
  {
    id: "kmh",
    name: "Kilometer/Hour",
    symbol: "km/h",
    toBase: (v) => v / 3.6,
    fromBase: (v) => v * 3.6,
  },
  {
    id: "mph",
    name: "Mile/Hour",
    symbol: "mph",
    toBase: (v) => v * 0.44704,
    fromBase: (v) => v / 0.44704,
  },
  {
    id: "fps",
    name: "Foot/Second",
    symbol: "ft/s",
    toBase: (v) => v * 0.3048,
    fromBase: (v) => v / 0.3048,
  },
  {
    id: "knot",
    name: "Knot",
    symbol: "kn",
    toBase: (v) => v * 0.514444,
    fromBase: (v) => v / 0.514444,
  },
  {
    id: "mach",
    name: "Mach (at sea level)",
    symbol: "Ma",
    toBase: (v) => v * 343,
    fromBase: (v) => v / 343,
  },
  {
    id: "c",
    name: "Speed of Light",
    symbol: "c",
    toBase: (v) => v * 299792458,
    fromBase: (v) => v / 299792458,
  },
];

// Pressure units (base: pascal)
const pressureUnits: UnitDefinition[] = [
  {
    id: "pa",
    name: "Pascal",
    symbol: "Pa",
    toBase: (v) => v,
    fromBase: (v) => v,
  },
  {
    id: "kpa",
    name: "Kilopascal",
    symbol: "kPa",
    toBase: (v) => v * 1000,
    fromBase: (v) => v / 1000,
  },
  {
    id: "mpa",
    name: "Megapascal",
    symbol: "MPa",
    toBase: (v) => v * 1e6,
    fromBase: (v) => v / 1e6,
  },
  {
    id: "bar",
    name: "Bar",
    symbol: "bar",
    toBase: (v) => v * 1e5,
    fromBase: (v) => v / 1e5,
  },
  {
    id: "mbar",
    name: "Millibar",
    symbol: "mbar",
    toBase: (v) => v * 100,
    fromBase: (v) => v / 100,
  },
  {
    id: "atm",
    name: "Atmosphere",
    symbol: "atm",
    toBase: (v) => v * 101325,
    fromBase: (v) => v / 101325,
  },
  {
    id: "psi",
    name: "PSI",
    symbol: "psi",
    toBase: (v) => v * 6894.76,
    fromBase: (v) => v / 6894.76,
  },
  {
    id: "torr",
    name: "Torr",
    symbol: "Torr",
    toBase: (v) => v * 133.322,
    fromBase: (v) => v / 133.322,
  },
  {
    id: "mmhg",
    name: "mmHg",
    symbol: "mmHg",
    toBase: (v) => v * 133.322,
    fromBase: (v) => v / 133.322,
  },
  {
    id: "inhg",
    name: "inHg",
    symbol: "inHg",
    toBase: (v) => v * 3386.39,
    fromBase: (v) => v / 3386.39,
  },
];

// Energy units (base: joule)
const energyUnits: UnitDefinition[] = [
  { id: "j", name: "Joule", symbol: "J", toBase: (v) => v, fromBase: (v) => v },
  {
    id: "kj",
    name: "Kilojoule",
    symbol: "kJ",
    toBase: (v) => v * 1000,
    fromBase: (v) => v / 1000,
  },
  {
    id: "mj",
    name: "Megajoule",
    symbol: "MJ",
    toBase: (v) => v * 1e6,
    fromBase: (v) => v / 1e6,
  },
  {
    id: "cal",
    name: "Calorie",
    symbol: "cal",
    toBase: (v) => v * 4.184,
    fromBase: (v) => v / 4.184,
  },
  {
    id: "kcal",
    name: "Kilocalorie",
    symbol: "kcal",
    toBase: (v) => v * 4184,
    fromBase: (v) => v / 4184,
  },
  {
    id: "wh",
    name: "Watt-hour",
    symbol: "Wh",
    toBase: (v) => v * 3600,
    fromBase: (v) => v / 3600,
  },
  {
    id: "kwh",
    name: "Kilowatt-hour",
    symbol: "kWh",
    toBase: (v) => v * 3.6e6,
    fromBase: (v) => v / 3.6e6,
  },
  {
    id: "mwh",
    name: "Megawatt-hour",
    symbol: "MWh",
    toBase: (v) => v * 3.6e9,
    fromBase: (v) => v / 3.6e9,
  },
  {
    id: "ev",
    name: "Electronvolt",
    symbol: "eV",
    toBase: (v) => v * 1.602e-19,
    fromBase: (v) => v / 1.602e-19,
  },
  {
    id: "kev",
    name: "Kiloelectronvolt",
    symbol: "keV",
    toBase: (v) => v * 1.602e-16,
    fromBase: (v) => v / 1.602e-16,
  },
  {
    id: "btu",
    name: "BTU",
    symbol: "BTU",
    toBase: (v) => v * 1055.06,
    fromBase: (v) => v / 1055.06,
  },
  {
    id: "therm",
    name: "Therm",
    symbol: "thm",
    toBase: (v) => v * 1.055e8,
    fromBase: (v) => v / 1.055e8,
  },
  {
    id: "erg",
    name: "Erg",
    symbol: "erg",
    toBase: (v) => v * 1e-7,
    fromBase: (v) => v / 1e-7,
  },
  {
    id: "ftlb",
    name: "Foot-pound",
    symbol: "ft-lb",
    toBase: (v) => v * 1.35582,
    fromBase: (v) => v / 1.35582,
  },
];

// Power units (base: watt)
const powerUnits: UnitDefinition[] = [
  { id: "w", name: "Watt", symbol: "W", toBase: (v) => v, fromBase: (v) => v },
  {
    id: "kw",
    name: "Kilowatt",
    symbol: "kW",
    toBase: (v) => v * 1000,
    fromBase: (v) => v / 1000,
  },
  {
    id: "mw",
    name: "Megawatt",
    symbol: "MW",
    toBase: (v) => v * 1e6,
    fromBase: (v) => v / 1e6,
  },
  {
    id: "gw",
    name: "Gigawatt",
    symbol: "GW",
    toBase: (v) => v * 1e9,
    fromBase: (v) => v / 1e9,
  },
  {
    id: "hp",
    name: "Horsepower",
    symbol: "hp",
    toBase: (v) => v * 745.7,
    fromBase: (v) => v / 745.7,
  },
  {
    id: "hp_m",
    name: "Metric Horsepower",
    symbol: "PS",
    toBase: (v) => v * 735.499,
    fromBase: (v) => v / 735.499,
  },
  {
    id: "btuh",
    name: "BTU/hour",
    symbol: "BTU/h",
    toBase: (v) => v * 0.293071,
    fromBase: (v) => v / 0.293071,
  },
  {
    id: "ftlbs",
    name: "Foot-pound/second",
    symbol: "ft-lb/s",
    toBase: (v) => v * 1.35582,
    fromBase: (v) => v / 1.35582,
  },
  {
    id: "cals",
    name: "Calorie/second",
    symbol: "cal/s",
    toBase: (v) => v * 4.184,
    fromBase: (v) => v / 4.184,
  },
];

// Data units (base: byte)
const dataUnits: UnitDefinition[] = [
  { id: "b", name: "Byte", symbol: "B", toBase: (v) => v, fromBase: (v) => v },
  {
    id: "kb",
    name: "Kilobyte",
    symbol: "KB",
    toBase: (v) => v * 1000,
    fromBase: (v) => v / 1000,
  },
  {
    id: "mb",
    name: "Megabyte",
    symbol: "MB",
    toBase: (v) => v * 1e6,
    fromBase: (v) => v / 1e6,
  },
  {
    id: "gb",
    name: "Gigabyte",
    symbol: "GB",
    toBase: (v) => v * 1e9,
    fromBase: (v) => v / 1e9,
  },
  {
    id: "tb",
    name: "Terabyte",
    symbol: "TB",
    toBase: (v) => v * 1e12,
    fromBase: (v) => v / 1e12,
  },
  {
    id: "pb",
    name: "Petabyte",
    symbol: "PB",
    toBase: (v) => v * 1e15,
    fromBase: (v) => v / 1e15,
  },
  {
    id: "kib",
    name: "Kibibyte",
    symbol: "KiB",
    toBase: (v) => v * 1024,
    fromBase: (v) => v / 1024,
  },
  {
    id: "mib",
    name: "Mebibyte",
    symbol: "MiB",
    toBase: (v) => v * 1048576,
    fromBase: (v) => v / 1048576,
  },
  {
    id: "gib",
    name: "Gibibyte",
    symbol: "GiB",
    toBase: (v) => v * 1073741824,
    fromBase: (v) => v / 1073741824,
  },
  {
    id: "tib",
    name: "Tebibyte",
    symbol: "TiB",
    toBase: (v) => v * 1099511627776,
    fromBase: (v) => v / 1099511627776,
  },
  {
    id: "pib",
    name: "Pebibyte",
    symbol: "PiB",
    toBase: (v) => v * 1125899906842624,
    fromBase: (v) => v / 1125899906842624,
  },
  {
    id: "bit",
    name: "Bit",
    symbol: "bit",
    toBase: (v) => v / 8,
    fromBase: (v) => v * 8,
  },
  {
    id: "kbit",
    name: "Kilobit",
    symbol: "kbit",
    toBase: (v) => v * 125,
    fromBase: (v) => v / 125,
  },
  {
    id: "mbit",
    name: "Megabit",
    symbol: "Mbit",
    toBase: (v) => v * 125000,
    fromBase: (v) => v / 125000,
  },
  {
    id: "gbit",
    name: "Gigabit",
    symbol: "Gbit",
    toBase: (v) => v * 125000000,
    fromBase: (v) => v / 125000000,
  },
];

// Angle units (base: degree)
const angleUnits: UnitDefinition[] = [
  {
    id: "deg",
    name: "Degree",
    symbol: "deg",
    toBase: (v) => v,
    fromBase: (v) => v,
  },
  {
    id: "rad",
    name: "Radian",
    symbol: "rad",
    toBase: (v) => v * (180 / Math.PI),
    fromBase: (v) => v * (Math.PI / 180),
  },
  {
    id: "grad",
    name: "Gradian",
    symbol: "grad",
    toBase: (v) => v * 0.9,
    fromBase: (v) => v / 0.9,
  },
  {
    id: "arcmin",
    name: "Arcminute",
    symbol: "'",
    toBase: (v) => v / 60,
    fromBase: (v) => v * 60,
  },
  {
    id: "arcsec",
    name: "Arcsecond",
    symbol: '"',
    toBase: (v) => v / 3600,
    fromBase: (v) => v * 3600,
  },
  {
    id: "turn",
    name: "Turn",
    symbol: "tr",
    toBase: (v) => v * 360,
    fromBase: (v) => v / 360,
  },
  {
    id: "mrad",
    name: "Milliradian",
    symbol: "mrad",
    toBase: (v) => v * (180 / (Math.PI * 1000)),
    fromBase: (v) => v * ((Math.PI * 1000) / 180),
  },
];

// Frequency units (base: hertz)
const frequencyUnits: UnitDefinition[] = [
  {
    id: "hz",
    name: "Hertz",
    symbol: "Hz",
    toBase: (v) => v,
    fromBase: (v) => v,
  },
  {
    id: "khz",
    name: "Kilohertz",
    symbol: "kHz",
    toBase: (v) => v * 1000,
    fromBase: (v) => v / 1000,
  },
  {
    id: "mhz",
    name: "Megahertz",
    symbol: "MHz",
    toBase: (v) => v * 1e6,
    fromBase: (v) => v / 1e6,
  },
  {
    id: "ghz",
    name: "Gigahertz",
    symbol: "GHz",
    toBase: (v) => v * 1e9,
    fromBase: (v) => v / 1e9,
  },
  {
    id: "thz",
    name: "Terahertz",
    symbol: "THz",
    toBase: (v) => v * 1e12,
    fromBase: (v) => v / 1e12,
  },
  {
    id: "rpm",
    name: "RPM",
    symbol: "rpm",
    toBase: (v) => v / 60,
    fromBase: (v) => v * 60,
  },
  {
    id: "rps",
    name: "RPS",
    symbol: "rps",
    toBase: (v) => v,
    fromBase: (v) => v,
  },
  {
    id: "bpm",
    name: "BPM",
    symbol: "bpm",
    toBase: (v) => v / 60,
    fromBase: (v) => v * 60,
  },
];

// Force units (base: newton)
const forceUnits: UnitDefinition[] = [
  {
    id: "n",
    name: "Newton",
    symbol: "N",
    toBase: (v) => v,
    fromBase: (v) => v,
  },
  {
    id: "kn",
    name: "Kilonewton",
    symbol: "kN",
    toBase: (v) => v * 1000,
    fromBase: (v) => v / 1000,
  },
  {
    id: "mn",
    name: "Meganewton",
    symbol: "MN",
    toBase: (v) => v * 1e6,
    fromBase: (v) => v / 1e6,
  },
  {
    id: "dyn",
    name: "Dyne",
    symbol: "dyn",
    toBase: (v) => v * 1e-5,
    fromBase: (v) => v / 1e-5,
  },
  {
    id: "lbf",
    name: "Pound-force",
    symbol: "lbf",
    toBase: (v) => v * 4.44822,
    fromBase: (v) => v / 4.44822,
  },
  {
    id: "kgf",
    name: "Kilogram-force",
    symbol: "kgf",
    toBase: (v) => v * 9.80665,
    fromBase: (v) => v / 9.80665,
  },
  {
    id: "ozf",
    name: "Ounce-force",
    symbol: "ozf",
    toBase: (v) => v * 0.278014,
    fromBase: (v) => v / 0.278014,
  },
  {
    id: "pdl",
    name: "Poundal",
    symbol: "pdl",
    toBase: (v) => v * 0.138255,
    fromBase: (v) => v / 0.138255,
  },
];

// Fuel economy units (base: km per liter)
const fuelUnits: UnitDefinition[] = [
  {
    id: "kml",
    name: "km/L",
    symbol: "km/L",
    toBase: (v) => v,
    fromBase: (v) => v,
  },
  {
    id: "mpg_us",
    name: "MPG (US)",
    symbol: "mpg",
    toBase: (v) => v * 0.425144,
    fromBase: (v) => v / 0.425144,
  },
  {
    id: "mpg_uk",
    name: "MPG (UK)",
    symbol: "mpg",
    toBase: (v) => v * 0.354006,
    fromBase: (v) => v / 0.354006,
  },
  {
    id: "l100km",
    name: "L/100km",
    symbol: "L/100km",
    toBase: (v) => (v > 0 ? 100 / v : 0),
    fromBase: (v) => (v > 0 ? 100 / v : 0),
  },
];

// Cooking units (base: milliliter for volume-based)
const cookingUnits: UnitDefinition[] = [
  {
    id: "ml_cook",
    name: "Milliliter",
    symbol: "mL",
    toBase: (v) => v,
    fromBase: (v) => v,
  },
  {
    id: "l_cook",
    name: "Liter",
    symbol: "L",
    toBase: (v) => v * 1000,
    fromBase: (v) => v / 1000,
  },
  {
    id: "cup_us_cook",
    name: "US Cup",
    symbol: "cup",
    toBase: (v) => v * 236.588,
    fromBase: (v) => v / 236.588,
  },
  {
    id: "cup_metric",
    name: "Metric Cup",
    symbol: "cup",
    toBase: (v) => v * 250,
    fromBase: (v) => v / 250,
  },
  {
    id: "tbsp_cook",
    name: "Tablespoon",
    symbol: "tbsp",
    toBase: (v) => v * 14.7868,
    fromBase: (v) => v / 14.7868,
  },
  {
    id: "tsp_cook",
    name: "Teaspoon",
    symbol: "tsp",
    toBase: (v) => v * 4.92892,
    fromBase: (v) => v / 4.92892,
  },
  {
    id: "floz_us_cook",
    name: "US Fluid Ounce",
    symbol: "fl oz",
    toBase: (v) => v * 29.5735,
    fromBase: (v) => v / 29.5735,
  },
  {
    id: "pt_us_cook",
    name: "US Pint",
    symbol: "pt",
    toBase: (v) => v * 473.176,
    fromBase: (v) => v / 473.176,
  },
  {
    id: "qt_us_cook",
    name: "US Quart",
    symbol: "qt",
    toBase: (v) => v * 946.353,
    fromBase: (v) => v / 946.353,
  },
  {
    id: "gal_us_cook",
    name: "US Gallon",
    symbol: "gal",
    toBase: (v) => v * 3785.41,
    fromBase: (v) => v / 3785.41,
  },
  {
    id: "drop",
    name: "Drop",
    symbol: "drop",
    toBase: (v) => v * 0.05,
    fromBase: (v) => v / 0.05,
  },
  {
    id: "pinch",
    name: "Pinch",
    symbol: "pinch",
    toBase: (v) => v * 0.31,
    fromBase: (v) => v / 0.31,
  },
  {
    id: "dash",
    name: "Dash",
    symbol: "dash",
    toBase: (v) => v * 0.62,
    fromBase: (v) => v / 0.62,
  },
];

export const unitCategories: UnitCategoryDefinition[] = [
  { id: "length", name: "Length", baseUnit: "m", units: lengthUnits },
  { id: "mass", name: "Mass", baseUnit: "kg", units: massUnits },
  { id: "volume", name: "Volume", baseUnit: "l", units: volumeUnits },
  { id: "area", name: "Area", baseUnit: "m2", units: areaUnits },
  {
    id: "temperature",
    name: "Temperature",
    baseUnit: "c",
    units: temperatureUnits,
  },
  { id: "time", name: "Time", baseUnit: "s", units: timeUnits },
  { id: "speed", name: "Speed", baseUnit: "mps", units: speedUnits },
  { id: "pressure", name: "Pressure", baseUnit: "pa", units: pressureUnits },
  { id: "energy", name: "Energy", baseUnit: "j", units: energyUnits },
  { id: "power", name: "Power", baseUnit: "w", units: powerUnits },
  { id: "data", name: "Data Storage", baseUnit: "b", units: dataUnits },
  { id: "angle", name: "Angle", baseUnit: "deg", units: angleUnits },
  { id: "frequency", name: "Frequency", baseUnit: "hz", units: frequencyUnits },
  { id: "force", name: "Force", baseUnit: "n", units: forceUnits },
  { id: "fuel", name: "Fuel Economy", baseUnit: "kml", units: fuelUnits },
  { id: "cooking", name: "Cooking", baseUnit: "ml_cook", units: cookingUnits },
];

export function convert(
  value: number,
  fromUnitId: string,
  toUnitId: string,
  category: UnitCategory,
): number {
  const categoryDef = unitCategories.find((c) => c.id === category);
  if (!categoryDef) throw new Error(`Unknown category: ${category}`);

  const fromUnit = categoryDef.units.find((u) => u.id === fromUnitId);
  const toUnit = categoryDef.units.find((u) => u.id === toUnitId);

  if (!fromUnit) throw new Error(`Unknown unit: ${fromUnitId}`);
  if (!toUnit) throw new Error(`Unknown unit: ${toUnitId}`);

  // Convert to base unit, then to target unit
  const baseValue = fromUnit.toBase(value);
  return toUnit.fromBase(baseValue);
}

export function formatNumber(value: number, precision: number = 10): string {
  if (value === 0) return "0";

  const absValue = Math.abs(value);

  // Use scientific notation for very large or very small numbers
  if (absValue >= 1e12 || (absValue < 1e-6 && absValue !== 0)) {
    return value.toExponential(precision);
  }

  // For normal numbers, use fixed precision and remove trailing zeros
  const fixed = value.toPrecision(precision);
  const parsed = parseFloat(fixed);

  // Format with appropriate decimal places
  if (Number.isInteger(parsed)) {
    return parsed.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  return parsed.toLocaleString("en-US", { maximumFractionDigits: 10 });
}

export function getUnitsByCategory(category: UnitCategory): UnitDefinition[] {
  const categoryDef = unitCategories.find((c) => c.id === category);
  return categoryDef?.units ?? [];
}

export function getCategoryLabel(category: UnitCategory): string {
  const categoryDef = unitCategories.find((c) => c.id === category);
  return categoryDef?.name ?? category;
}
