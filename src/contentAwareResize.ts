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

// Now we are trying to calculate EnergyMap.
const calculateEnergyMap = (img: ImageData, {w, h}: ImageSize): EnergyMap => {
    // Create an empty energy map where each pixel has infinitely high energy.
    const energyMap: number[][] = matrix<number>(w, h, Infinity);
    // Then update energy for each pixel.
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const leftPixel = (x - 1) >= 0 ? getPixel(img, {x: x-1, y}) : null;
            const middlePixel = getPixel(img, {x,y});
            const rightPixel = (x + 1) < w ? getPixel(img, {x: x+1, y}) : null;
            energyMap[y][x] = getPixelEnergy(leftPixel, middlePixel, rightPixel);
        }
    }
    return energyMap;
}

// A helper function that generates a 2D array prefilled with generic type data.
const matrix = <T>(w: number, h: number, filler: T): T[][] => {
    return new Array(h).fill(null).map(()=>{
        return new Array(w).fill(filler);
    });
};

// Can have a helper function to calculate the energy of a pixel.
const getPixelEnergy = (left: Color | null, middle: Color, right: Color | null): number => {
    // Middle pixel is the pixel we're calculating the energy for.
    const [mR, mG, mB] = middle;

    // Energy contributed by left pixel.
    let lEnergy = 0;
    if (left) {
        const [lR, lG, lB] = left;
        lEnergy = (lR - mR) ** 2 + (lG - mG) ** 2 + (lB - mB) ** 2;
    }

    // Energy contributed by right pixel.
    let rEnergy = 0;
    if (left) {
        const [rR, rG, rB] = right;
        rEnergy = (rR - mR) ** 2 + (rG - mG) ** 2 + (rB - mB) ** 2;
    }

    return Math.sqrt(lEnergy + rEnergy);
}

// Helper function that returns the color of a specified pixel from ImageData
const getPixel = (img: ImageData, {x, y}: Coordinate): Color => {
    // The ImageData.data is a flat 1D array, every 4 consecutive numbers represent a
    // pixel, eg, [r0, g0, b0, a0, r1, g1, b1, a1,...]
    // Thus need to convert {x,y} coordinate into linear index.
    const i = y * img.width + x;
    const cellsPerColor = 4;  // RGBA.

    return img.data.subarray(i * cellsPerColor, i * cellsPerColor + cellsPerColor);
}


/*************************findLowEnergySeam********************** */
// The metadata for the pixels in the seam.
type SeamPixelMeta = {
    energy: number,  // The energy of the pixel.
    coordinate: Coordinate,  // The coordinate of the pixel.
    previous: Coordinate | null,  // The previous pixel in a seam. (can be used to retrieve the seam)
}

// Finds the seam (the sequence of pixels from top to bottom) that has the
// lowest resulting energy using bottom-up Dynamic Programming approach.
const findLowEnergySeam(energyMap: EnergyMap, {w, h}: ImageSize): Seam => {
    // need a 2D array of SeamPixelMeta to store the lowest energy for each pixel, and its prev pixel.
    const seamEnergies: (SeamPixelMeta | null)[][] = matrix<SeamPixelMeta | null>(w, h, null);

    // Populate the first row of the map by just copying the energy map.
    for (let col = 0; col < w; col++) {
        seamEnergies[0][col] = {
            energy: energyMap[0][col],
            coordinate: {x: 0, y: col},
            previous: null,
        };
    }

    // Populate the rest of the map.
    for (let y = 1; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let minPrevEnergy: number = Infinity;
            let minPrevX: number = x;
            for (let i = (x - 1); i <= (x + 1); i++) {
                if (i >= 0 && i < w && seamEnergies[y-1][i].energy < minPrevEnergy) {
                    minPrevEnergy = seamEnergies[y-1][i].energy;
                    minPrevX = i;
                }
            }

            seamEnergies[y][x] = {
                energy: minPrevEnergy + energyMap[y][x],
                coordinate: {x, y},
                previous: {x: minPrevX, y: y-1},
            };
        }
    }

    // Find the lowest energy seam.
    // where is it on the last row?
    let lastMinCoordinate: Coordinate | null = null;
    let minSeamEnergy = Infinity;
    for (let x = 0; x < w; x++) {
        const y = h - 1;
        if (seamEnergies[y][x].energy < minSeamEnergy) {
            minSeamEnergy = seamEnergies[y][x].energy;
            lastMinCoordinate = {x, y};
        }
    }

    // Backtracking from the lowest energy pixel on last row.
    const seam: Seam = [];  // Initialize an empty array
    if (!lastMinCoordinate) {
        return seam;
    }

    const {x: lastMinX, y: lastMinY} = lastMinCoordinate;

    let currentSeam = seamEnergies[lastMinY][lastMinX];
    while (currentSeam) {
        seam.push(currentSeam.coordinate);
        const prevMinCoordinates = currentSeam.previous;
        if (!prevMinCoordinates) {
            currentSeam = null;
        } else {
            currentSeam = seamEnergies[prevMinCoordinates.y][prevMinCoordinates.x];
        }
    }

    return seam;
}

