declare module 'decimal.js' {
  export default class Decimal {
    constructor(value: number | string | Decimal);
    plus(value: number | string | Decimal): Decimal;
    minus(value: number | string | Decimal): Decimal;
    mul(value: number | string | Decimal): Decimal;
    div(value: number | string | Decimal): Decimal;
    toDecimalPlaces(decimalPlaces: number, roundingMode?: number): Decimal;
    toNumber(): number;
    toString(): string;
    toFixed(decimalPlaces?: number): string;
  }
}
