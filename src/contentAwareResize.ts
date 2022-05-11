// An object type with two properties that describes the image size (width and height).
type ImageSize = {w: number, h: number};

// The coordinate of the pixel.
type Coordinate = {x: number, y: number};

// The seam is a sequence of pixels (coordinates), either from top to bottom or from left to right.
type Seam = Coordinate[];

// Energy map is a 2D array that has the same width and height
// as the image the map is being calcualted for.
type EnergyMap = number[][];

// type that describes the image pixel's RGBA color.
type Color = [
    r: number,  // red
    g: number,  // green
    b: number,  // blue
    a: number,  // transparency
    ] | Uint8ClampedArray;  // an array of 8-bit unsigned integers clamped to 0-255

// the input(argument) type to ResizeImageWidth function
type ResizeImageWidthArgs = {
    img: ImageData,  // image data we want to resize. ImageData is a javascript interface
    toWidth: number,
};

// the output type of ResizeImageWidth function
type ResizeImageWidthResult = {
    img: ImageData,  // resized image data.
    size: ImageSize, // 
}

// Performs the content-aware image width resizing using the seam carving method.
// The main ResizeImageWidth function
export const ResizeImageWidth = (
    {img, toWidth}: ResizeImageWidthArgs,
): ResizeImageWidthResult => {
    const size: ImageSize = {w: img.width, h: img.height};

    // Calculating the number of pixel to remove.
    const pxToRemove = img.width - toWidth;
    if (pxToRemove < 0) {
        throw new Error('Upsizing is not supported for now.');
    }

    let energyMap: EnergyMap | null = null;
    let seam: Seam | null = null;

    // Removing the lowest energy seams one by one.
    for (let i = 0; i < pxToRemove; i++) {
        // 1. Calculate the energy map for the current version of the image.
        energyMap = calculateEnergyMap(img, size);
        
        // 2. Find the seam with the lowest energy based on energy map.
        seam = findLowEnergySeam(energyMap, size);

        // 3. Delete that seam.
        deleteSeam(img, seam, size);

        // updating the img size.
        size.w -= 1;
    }

    return {img, size};
}