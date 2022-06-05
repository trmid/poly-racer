
/**
 * Returns the number padded with zeros at the start until {length} is reached.
 * 
 * @param value number
 * @param length number
 * @returns string
 */
export function zeroPad(value: number, length: number) {
  let str = "" + value;
  while(str.length < length) {
    str = '0' + str;
  }
  return str;
}