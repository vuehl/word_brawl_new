// CSS uses a decimal point, no grouping, and at most six fractional digits.
// linkedom handles zero, NaN and infinities before calling this formatter.
export function formatFiniteCssNumber(value) {
  const sign = value < 0 ? '-' : '';
  const [mantissa, exponent = '0'] = String(Math.abs(value)).split('e');
  const [integer, fraction = ''] = mantissa.split('.');
  const digits = integer + fraction;
  const point = integer.length + Number(exponent);
  if (point >= digits.length) return sign + digits + '0'.repeat(point - digits.length);

  const start = Math.max(0, point);
  const whole = digits.slice(0, start) || '0';
  const decimals = '0'.repeat(start - point) + digits.slice(start);
  if (decimals.length <= 6) return sign + whole + '.' + decimals;

  // Round the decimal representation itself to avoid binary toFixed tie errors.
  const micros = Number(decimals.slice(0, 6)) + (decimals[6] >= '5' ? 1 : 0);
  if (micros === 1000000) return sign + String(Number(whole) + 1);
  if (micros === 0) return whole === '0' ? '0' : sign + whole;
  const suffix = ('00000' + micros).slice(-6).replace(/0+$/, '');
  return sign + whole + '.' + suffix;
}
