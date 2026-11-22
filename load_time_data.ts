import { assert } from './assert.js';

class LoadTimeData {
  private data_: Record<string, any> | null = null;

  set data(value: Record<string, any>) {
    assert(!this.data_, 'Re-setting data.');
    this.data_ = value;
  }

  valueExists(id: string): boolean {
    assert(this.data_, 'No data. Did you remember to include strings.js?');
    return id in this.data_;
  }

  getValue(id: string): any {
    assert(this.data_, 'No data. Did you remember to include strings.js?');
    const value = this.data_[id];
    assert(typeof value !== 'undefined', 'Could not find value for ' + id);
    return value;
  }

  getString(id: string): string {
    const value = this.getValue(id);
    assert(typeof value === 'string', `[${value}] (${id}) is not a string`);
    return value;
  }

  getStringF(id: string, ...args: any[]): string {
    const value = this.getString(id);
    if (!value) return '';
    return this.substituteString(value, ...args);
  }

  substituteString(label: string, ...args: any[]): string {
    return label.replace(/\$(.|$|\n)/g, (m) => {
      assert(m.match(/\$[$1-9]/), 'Unescaped $ found in localized string.');
      if (m === '$$') return '$';
      const substitute = args[Number(m[1]) - 1];
      if (substitute === undefined || substitute === null) return '';
      return substitute.toString();
    });
  }

  getSubstitutedStringPieces(label: string, ...args: any[]) {
    return (label.match(/(\$[1-9])|(([^$]|\$([^1-9]|$))+)/g) || []).map((p) => {
      if (!p.match(/^\$[1-9]$/)) {
        assert(
          (p.match(/\$/g) || []).length % 2 === 0,
          'Unescaped $ found in localized string.',
        );
        return { value: p.replace(/\$\$/g, '$'), arg: null };
      }
      const substitute = args[Number(p[1]) - 1];
      if (substitute === undefined || substitute === null) {
        return { value: '', arg: p };
      }
      return { value: substitute.toString(), arg: p };
    });
  }

  getBoolean(id: string): boolean {
    const value = this.getValue(id);
    assert(typeof value === 'boolean', `[${value}] (${id}) is not a boolean`);
    return value;
  }

  getInteger(id: string): number {
    const value = this.getValue(id);
    assert(typeof value === 'number', `[${value}] (${id}) is not a number`);
    assert(value === Math.floor(value), "Number isn't integer: " + value);
    return value;
  }

  overrideValues(replacements: Record<string, any>): void {
    assert(typeof replacements === 'object', 'Replacements must be a dictionary object.');
    assert(this.data_, 'Data must exist before being overridden');
    for (const key in replacements) this.data_[key] = replacements[key];
  }

  resetForTesting(newData: Record<string, any> | null = null): void {
    this.data_ = newData;
  }

  isInitialized(): boolean {
    return this.data_ !== null;
  }
}

export const loadTimeData = new LoadTimeData();
