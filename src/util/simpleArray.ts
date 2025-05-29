export const fixedArray = <T>(size: number) => {
  const arr: T[] = []
  arr.push = function (...items: T[]) {
    if (this.length + items.length > size) {
      this.splice(0, this.length + items.length - size)
    }
    return Array.prototype.push.apply(this, items)
  }
  return arr
}
