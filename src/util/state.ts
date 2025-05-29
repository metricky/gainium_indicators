export const lastIndexOfEnum = (enumObj: object): number =>
  Math.max(
    ...(Object.values(enumObj).filter(
      (value) => typeof value === 'number',
    ) as number[]),
  ) + 1
