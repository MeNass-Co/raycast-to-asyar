/** Incremental newline-delimited JSON decoder. */
export class LineDecoder {
  private buf = '';
  push(chunk: string, onLine: (line: string) => void): void {
    this.buf += chunk;
    let i: number;
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, i);
      this.buf = this.buf.slice(i + 1);
      if (line.trim()) onLine(line);
    }
  }
}
