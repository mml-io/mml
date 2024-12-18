export function calculateContentSize(opts: {
  content?: {
    width: number;
    height: number;
  };
  width: number | null;
  height: number | null;
}): { width: number; height: number } {
  if (opts.content) {
    const height = opts.height;
    const width = opts.width;
    const loadedWidth = Math.max(opts.content.width, 1);
    const loadedHeight = Math.max(opts.content.height, 1);

    if (height && width) {
      return { width, height };
    } else if (height && !width) {
      return {
        // compute width from height and content aspect ratio
        width: (height * loadedWidth) / loadedHeight,
        height,
      };
    } else if (!height && width) {
      return {
        width,
        // compute height from width and content aspect ratio
        height: (width * loadedHeight) / loadedWidth,
      };
    } else {
      return {
        width: 1,
        // compute height from content aspect ratio
        height: loadedHeight / loadedWidth,
      };
    }
  } else {
    // No content loaded - use the provided width and height if available
    return {
      width: opts.width !== null ? opts.width : 1,
      height: opts.height !== null ? opts.height : 1,
    };
  }
}
