import * as THREE from "three";

interface GeometryInfo {
  name: string;
  uuid: string;
  memoryBytes: number;
  vertexCount: number;
  triangleCount: number;
  usedByObjects: string[];
  objectPaths: string[];
  usedByObjectInstanceIds: string[];
}

interface TextureInfo {
  name: string;
  uuid: string;
  memoryBytes: number;
  width: number;
  height: number;
  format: string;
  usedByMaterials: string[];
  usedByObjects: string[];
  usedByObjectPaths: string[];
  usedByObjectInstanceIds: string[];
  url?: string;
  sourceType: string;
}

interface MaterialInfo {
  name: string;
  uuid: string;
  textureCount: number;
  textures: TextureInfo[];
  usedByObjects: string[];
}

interface MemoryStats {
  totalGeometryMemory: number;
  totalTextureMemory: number;
  totalMemory: number;
  geometryCount: number;
  textureCount: number;
  materialCount: number;
}

export class ThreeJSMemoryInspector {
  /**
   * Opens a new window with a comprehensive memory report including thumbnails
   */
  public static openMemoryReport(scene: THREE.Scene): void {
    const reportWindow = window.open(
      "",
      "_blank",
      "width=1200,height=800,scrollbars=yes,resizable=yes",
    );

    if (!reportWindow) {
      console.error("Failed to open memory report window. Please check popup blockers.");
      return;
    }

    // Collect memory data and generate thumbnails
    const { geometries, textures, materials, stats } = ThreeJSMemoryInspector.analyzeScene(scene);
    const textureThumbnails = ThreeJSMemoryInspector.generateTextureThumbnails(scene);
    const geometryPreviews = ThreeJSMemoryInspector.generateGeometryPreviews(scene);

    // Build the UI programmatically in the popup window
    ThreeJSMemoryInspector.buildReportUI(
      reportWindow.document,
      geometries,
      textures,
      materials,
      stats,
      textureThumbnails,
      geometryPreviews,
    );
  }

  public static analyzeScene(scene: THREE.Scene): {
    geometries: Map<string, GeometryInfo>;
    textures: Map<string, TextureInfo>;
    materials: Map<string, MaterialInfo>;
    stats: MemoryStats;
  } {
    const geometries = new Map<string, GeometryInfo>();
    const textures = new Map<string, TextureInfo>();
    const materials = new Map<string, MaterialInfo>();

    // First pass: collect all assets and their relationships
    scene.traverse((object) => {
      const asMesh = object as THREE.Mesh;
      if (asMesh.isMesh) {
        const objectPath = ThreeJSMemoryInspector.getObjectPath(asMesh, scene);
        const objectName = ThreeJSMemoryInspector.getObjectDisplayName(asMesh);

        // Collect geometry info
        if (asMesh.geometry) {
          const geometry = asMesh.geometry;
          if (!geometries.has(geometry.uuid)) {
            geometries.set(
              geometry.uuid,
              ThreeJSMemoryInspector.analyzeGeometry(geometry, objectName, objectPath, asMesh.uuid),
            );
          } else {
            // Add this instance to geometry usage (dedupe by instance id)
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const geometryInfo = geometries.get(geometry.uuid)!;
            if (!geometryInfo.usedByObjectInstanceIds.includes(asMesh.uuid)) {
              geometryInfo.usedByObjectInstanceIds.push(asMesh.uuid);
              geometryInfo.usedByObjects.push(objectName);
              geometryInfo.objectPaths.push(objectPath);
            }
          }
        }

        // Collect material info
        const materialsArray = Array.isArray(asMesh.material) ? asMesh.material : [asMesh.material];
        materialsArray.forEach((material) => {
          if (material) {
            if (!materials.has(material.uuid)) {
              const materialInfo = ThreeJSMemoryInspector.analyzeMaterial(
                material,
                objectName,
                objectPath,
                asMesh.uuid,
              );
              materials.set(material.uuid, materialInfo);

              // Collect textures from this material
              materialInfo.textures.forEach((textureInfo) => {
                if (!textures.has(textureInfo.uuid)) {
                  textures.set(textureInfo.uuid, textureInfo);
                } else {
                  // Add this instance to the existing texture's usage (dedupe by instance id)
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  const existingTexture = textures.get(textureInfo.uuid)!;
                  if (
                    !existingTexture.usedByMaterials.includes(
                      material.name || material.uuid.substring(0, 8),
                    )
                  ) {
                    existingTexture.usedByMaterials.push(
                      material.name || material.uuid.substring(0, 8),
                    );
                  }
                  if (!existingTexture.usedByObjectInstanceIds.includes(asMesh.uuid)) {
                    existingTexture.usedByObjectInstanceIds.push(asMesh.uuid);
                    existingTexture.usedByObjects.push(objectName);
                    existingTexture.usedByObjectPaths.push(objectPath);
                  }
                }
              });
            } else {
              // Add this object to the existing material's usage list
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              const materialInfo = materials.get(material.uuid)!;
              if (!materialInfo.usedByObjects.includes(objectName)) {
                materialInfo.usedByObjects.push(objectName);
              }

              // Always update textures usage for this material instance
              const materialName = material.name || material.uuid.substring(0, 8);
              const textureProperties = [
                "map",
                "normalMap",
                "roughnessMap",
                "metalnessMap",
                "aoMap",
                "emissiveMap",
                "bumpMap",
                "displacementMap",
                "alphaMap",
                "lightMap",
                "envMap",
              ];
              textureProperties.forEach((prop) => {
                const texture = (material as any)[prop];
                if (texture && texture.isTexture) {
                  if (!textures.has(texture.uuid)) {
                    textures.set(
                      texture.uuid,
                      ThreeJSMemoryInspector.analyzeTexture(
                        texture,
                        materialName,
                        objectName,
                        objectPath,
                        asMesh.uuid,
                      ),
                    );
                  } else {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    const existingTexture = textures.get(texture.uuid)!;
                    if (!existingTexture.usedByMaterials.includes(materialName)) {
                      existingTexture.usedByMaterials.push(materialName);
                    }
                    if (!existingTexture.usedByObjectInstanceIds.includes(asMesh.uuid)) {
                      existingTexture.usedByObjectInstanceIds.push(asMesh.uuid);
                      existingTexture.usedByObjects.push(objectName);
                      existingTexture.usedByObjectPaths.push(objectPath);
                    }
                  }
                }
              });
            }
          }
        });
      }
    });

    // Calculate totals
    const totalGeometryMemory = Array.from(geometries.values()).reduce(
      (sum, geo) => sum + geo.memoryBytes,
      0,
    );

    const totalTextureMemory = Array.from(textures.values()).reduce(
      (sum, tex) => sum + tex.memoryBytes,
      0,
    );

    const totalMemory = totalGeometryMemory + totalTextureMemory;

    const stats: MemoryStats = {
      geometryCount: geometries.size,
      textureCount: textures.size,
      materialCount: materials.size,
      totalGeometryMemory,
      totalTextureMemory,
      totalMemory,
    };

    return { geometries, textures, materials, stats };
  }

  private static analyzeGeometry(
    geometry: THREE.BufferGeometry,
    objectName: string,
    objectPath: string,
    objectInstanceId: string,
  ): GeometryInfo {
    let memoryBytes = 0;
    let vertexCount = 0;
    let triangleCount = 0;

    // Calculate memory usage from attributes
    for (const name in geometry.attributes) {
      const attribute = geometry.attributes[name];
      memoryBytes += attribute.count * attribute.itemSize * attribute.array.BYTES_PER_ELEMENT;
    }

    // Add index buffer memory if present
    if (geometry.index) {
      memoryBytes += geometry.index.count * geometry.index.array.BYTES_PER_ELEMENT;
      triangleCount = geometry.index.count / 3;
    }

    // Get vertex count
    if (geometry.attributes.position) {
      vertexCount = geometry.attributes.position.count;
      if (!geometry.index) {
        triangleCount = vertexCount / 3;
      }
    }

    return {
      name: geometry.name || `Geometry_${geometry.uuid.substring(0, 8)}`,
      uuid: geometry.uuid,
      memoryBytes,
      vertexCount,
      triangleCount,
      usedByObjects: [objectName],
      objectPaths: [objectPath],
      usedByObjectInstanceIds: [objectInstanceId],
    };
  }

  private static analyzeMaterial(
    material: THREE.Material,
    objectName: string,
    objectPath: string,
    objectInstanceId: string,
  ): MaterialInfo {
    const textures: TextureInfo[] = [];
    let textureCount = 0;

    // Check common texture properties
    const textureProperties = [
      "map",
      "normalMap",
      "roughnessMap",
      "metalnessMap",
      "aoMap",
      "emissiveMap",
      "bumpMap",
      "displacementMap",
      "alphaMap",
      "lightMap",
      "envMap",
    ];

    textureProperties.forEach((prop) => {
      const texture = (material as any)[prop];
      if (texture && texture.isTexture) {
        textures.push(
          ThreeJSMemoryInspector.analyzeTexture(
            texture,
            material.name || material.uuid.substring(0, 8),
            objectName,
            objectPath,
            objectInstanceId,
          ),
        );
        textureCount++;
      }
    });

    return {
      name: material.name || `Material_${material.uuid.substring(0, 8)}`,
      uuid: material.uuid,
      textureCount,
      textures,
      usedByObjects: [objectName],
    };
  }

  private static analyzeTexture(
    texture: THREE.Texture,
    materialName: string,
    objectName: string,
    objectPath?: string,
    objectInstanceId?: string,
  ): TextureInfo {
    let memoryBytes = 0;
    let width = 0;
    let height = 0;
    let format = "Unknown";

    // Check if this is a compressed texture (e.g., KTX2)
    const textureAny = texture as any;
    if (textureAny.isCompressedTexture) {
      // For compressed textures, calculate actual GPU memory from mipmaps
      const result = ThreeJSMemoryInspector.calculateCompressedTextureMemory(texture);
      memoryBytes = result.memoryBytes;
      width = result.width;
      height = result.height;
      format = result.format;
    } else if (textureAny.isDataTexture && texture.image) {
      // DataTexture has image: { data: TypedArray, width: number, height: number }
      width = texture.image.width || 0;
      height = texture.image.height || 0;

      // Calculate actual memory from the data array
      if (texture.image.data && texture.image.data.byteLength) {
        // For DataTexture, use actual byte length
        memoryBytes = texture.image.data.byteLength;
        // If mipmaps are generated, add their memory (approximately 1/3 additional)
        if (texture.generateMipmaps) {
          memoryBytes *= 1.333;
        }
      } else {
        // Fallback estimation: width * height * bytes per pixel
        memoryBytes = width * height * 4;
        if (texture.generateMipmaps) {
          memoryBytes *= 1.333;
        }
      }

      if (texture.format) {
        format = ThreeJSMemoryInspector.getTextureFormatName(texture.format);
      }
    } else if (texture.image) {
      width = texture.image.width || 0;
      height = texture.image.height || 0;

      // Estimate memory usage: width * height * bytes per pixel * mipmap factor
      // Assuming RGBA (4 bytes per pixel) and including mipmaps (factor of 1.333)
      memoryBytes = width * height * 4 * 1.333;

      // Adjust for different formats if we can detect them
      if (texture.format) {
        format = ThreeJSMemoryInspector.getTextureFormatName(texture.format);
      }
    }

    // Try to get the texture URL and source type
    let url: string | undefined;
    let sourceType = "Unknown";

    if (textureAny.isCompressedTexture) {
      sourceType = "Compressed Texture (KTX2)";
      url = `${width}x${height} - ${format}`;
    } else if (textureAny.isDataTexture) {
      sourceType = "DataTexture (Label/Generated)";
      url = `${width}x${height} - ${format}`;
    } else if (texture.source && texture.source.data) {
      const sourceData = texture.source.data;

      if (sourceData.src) {
        url = sourceData.src;
        if (url && url.startsWith("data:")) {
          sourceType = "Data URL";
          url = `${url.substring(0, 50)}...`; // Truncate data URLs
        } else if (url && url.startsWith("blob:")) {
          sourceType = "Blob URL";
        } else {
          sourceType = "File URL";
        }
      } else if (sourceData instanceof HTMLCanvasElement) {
        sourceType = "Canvas";
        url = `Canvas(${sourceData.width}x${sourceData.height})`;
      } else if (sourceData instanceof ImageData) {
        sourceType = "ImageData";
        url = `ImageData(${sourceData.width}x${sourceData.height})`;
      } else if (sourceData instanceof HTMLVideoElement) {
        sourceType = "Video";
        url = sourceData.src || "Video Element";
      } else if (sourceData.constructor.name === "ImageBitmap") {
        sourceType = "ImageBitmap";
        url = `ImageBitmap(${(sourceData as any).width}x${(sourceData as any).height})`;
      } else if (sourceData.data && sourceData.width && sourceData.height) {
        // This is a DataTexture-like structure
        sourceType = "DataTexture (Raw Data)";
        url = `${sourceData.width}x${sourceData.height}`;
      }
    } else if ((texture as any).image) {
      const image = (texture as any).image;
      if (image.src) {
        url = image.src;
        if (url && url.startsWith("data:")) {
          sourceType = "Data URL";
          url = `${url.substring(0, 50)}...`;
        } else if (url && url.startsWith("blob:")) {
          sourceType = "Blob URL";
        } else {
          sourceType = "File URL";
        }
      } else if (image instanceof HTMLCanvasElement) {
        sourceType = "Canvas";
        url = `Canvas(${image.width}x${image.height})`;
      } else if (image.data && image.width && image.height) {
        // This is a DataTexture-like structure in the image property
        sourceType = "DataTexture (Raw Data)";
        url = `${image.width}x${image.height}`;
      }
    }

    return {
      name: texture.name || `Texture_${texture.uuid.substring(0, 8)}`,
      uuid: texture.uuid,
      memoryBytes,
      width,
      height,
      format,
      usedByMaterials: [materialName],
      usedByObjects: [objectName],
      usedByObjectPaths: [objectPath || objectName],
      usedByObjectInstanceIds: [objectInstanceId || "unknown"],
      url,
      sourceType,
    };
  }

  private static getTextureFormatName(format: number): string {
    // Map Three.js texture format constants to readable names
    const formatNames: { [key: number]: string } = {
      1023: "RGBA",
      1022: "RGB",
      1024: "RGBAInteger",
      1025: "RGBInteger",
      1026: "DepthComponent",
      1027: "DepthStencil",
      1028: "LuminanceAlpha",
      1029: "Luminance",
      1030: "Alpha",
      1031: "Red",
      1032: "RedInteger",
      1033: "RG",
      1034: "RGInteger",
      // Compressed formats
      33776: "RGB_S3TC_DXT1",
      33777: "RGBA_S3TC_DXT1",
      33778: "RGBA_S3TC_DXT3",
      33779: "RGBA_S3TC_DXT5",
      35840: "RGB_PVRTC_4BPPV1",
      35841: "RGB_PVRTC_2BPPV1",
      35842: "RGBA_PVRTC_4BPPV1",
      35843: "RGBA_PVRTC_2BPPV1",
      36196: "RGB_ETC1",
      37808: "RGBA_ASTC_4x4",
      37809: "RGBA_ASTC_5x4",
      37810: "RGBA_ASTC_5x5",
      37811: "RGBA_ASTC_6x5",
      37812: "RGBA_ASTC_6x6",
      37813: "RGBA_ASTC_8x5",
      37814: "RGBA_ASTC_8x6",
      37815: "RGBA_ASTC_8x8",
      37816: "RGBA_ASTC_10x5",
      37817: "RGBA_ASTC_10x6",
      37818: "RGBA_ASTC_10x8",
      37819: "RGBA_ASTC_10x10",
      37820: "RGBA_ASTC_12x10",
      37821: "RGBA_ASTC_12x12",
      37492: "RGBA_BPTC_UNORM",
      36492: "RGB_ETC2",
      36494: "RGBA_ETC2_EAC",
    };

    return formatNames[format] || `Format_${format}`;
  }

  private static calculateCompressedTextureMemory(texture: THREE.Texture): {
    memoryBytes: number;
    width: number;
    height: number;
    format: string;
  } {
    const textureAny = texture as any;
    let totalMemory = 0;
    let width = 0;
    let height = 0;
    let format = "Unknown Compressed";

    if (texture.format) {
      format = ThreeJSMemoryInspector.getTextureFormatName(texture.format);
    }

    // Compressed textures store data in mipmaps array
    if (textureAny.mipmaps && Array.isArray(textureAny.mipmaps)) {
      for (const mipmap of textureAny.mipmaps) {
        if (mipmap.data && mipmap.data.byteLength) {
          totalMemory += mipmap.data.byteLength;
          // Use the largest mipmap (first one) for dimensions
          if (width === 0) {
            width = mipmap.width || 0;
            height = mipmap.height || 0;
          }
        }
      }
    }

    // If we couldn't get dimensions from mipmaps, try the texture's image property
    if (width === 0 && textureAny.image) {
      width = textureAny.image.width || 0;
      height = textureAny.image.height || 0;
    }

    return {
      memoryBytes: totalMemory,
      width,
      height,
      format,
    };
  }

  private static getObjectPath(object: any, scene: THREE.Scene): string {
    const path: string[] = [];
    let current = object;

    while (current && current !== scene) {
      const name = current.name || current.constructor.name || "Object";
      path.unshift(name);
      current = current.parent;
    }

    return path.join(" > ");
  }

  private static getObjectDisplayName(object: any): string {
    if (object.name) {
      return object.name;
    }

    // Try to find a meaningful parent name
    let current = object.parent;
    while (current && current !== object.parent?.parent) {
      if (current.name) {
        return `${current.name} > ${object.constructor.name}`;
      }
      current = current.parent;
    }

    return `${object.constructor.name}_${object.uuid.substring(0, 8)}`;
  }

  private static generateTextureThumbnails(scene: THREE.Scene): Map<string, string> {
    const thumbnails = new Map<string, string>();

    // Find all unique textures in the scene
    const textureMap = new Map<string, THREE.Texture>();

    scene.traverse((object) => {
      const asMesh = object as THREE.Mesh;
      if (asMesh.isMesh) {
        const materialsArray = Array.isArray(asMesh.material) ? asMesh.material : [asMesh.material];
        materialsArray.forEach((material) => {
          if (material) {
            const textureProperties = [
              "map",
              "normalMap",
              "roughnessMap",
              "metalnessMap",
              "aoMap",
              "emissiveMap",
              "bumpMap",
              "displacementMap",
              "alphaMap",
              "lightMap",
              "envMap",
            ];

            textureProperties.forEach((prop) => {
              const texture = (material as any)[prop];
              if (texture && texture.isTexture && !textureMap.has(texture.uuid)) {
                textureMap.set(texture.uuid, texture);
              }
            });
          }
        });
      }
    });

    // Generate thumbnails for each texture
    textureMap.forEach((texture, uuid) => {
      try {
        const thumbnail = ThreeJSMemoryInspector.createTextureThumbnail(texture);
        if (thumbnail) {
          thumbnails.set(uuid, thumbnail);
        }
      } catch (error) {
        console.warn(`Failed to generate thumbnail for texture ${uuid}:`, error);
      }
    });

    return thumbnails;
  }

  private static generateGeometryPreviews(scene: THREE.Scene): Map<string, string> {
    const previews = new Map<string, string>();

    // Find all unique geometries in the scene
    const geometryMap = new Map<string, THREE.BufferGeometry>();

    scene.traverse((object) => {
      const asMesh = object as THREE.Mesh;
      if (asMesh.isMesh && asMesh.geometry) {
        const geometry = asMesh.geometry;
        if (!geometryMap.has(geometry.uuid)) {
          geometryMap.set(geometry.uuid, geometry);
        }
      }
    });

    // Create a single renderer to reuse for all previews
    let sharedRenderer: THREE.WebGLRenderer | null = null;
    try {
      sharedRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      sharedRenderer.setSize(200, 200);
      sharedRenderer.setClearColor(0x222222, 0);

      // Generate previews for each geometry using the shared renderer
      geometryMap.forEach((geometry, uuid) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const preview = ThreeJSMemoryInspector.createGeometryPreview(geometry, sharedRenderer!);
          if (preview) {
            previews.set(uuid, preview);
          }
        } catch (error) {
          console.warn(`Failed to generate preview for geometry ${uuid}:`, error);
        }
      });
    } catch (error) {
      console.warn("Failed to initialize shared WebGLRenderer for geometry previews:", error);
    } finally {
      if (sharedRenderer) {
        sharedRenderer.dispose();
      }
    }

    return previews;
  }

  private static createTextureThumbnail(texture: THREE.Texture): string | null {
    try {
      const textureAny = texture as any;

      // Check if this is a compressed texture
      if (textureAny.isCompressedTexture) {
        return ThreeJSMemoryInspector.createCompressedTextureThumbnail(texture);
      }

      // Check if this is a DataTexture - render it using WebGL
      if (textureAny.isDataTexture) {
        return ThreeJSMemoryInspector.createCompressedTextureThumbnail(texture);
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        return null;
      }

      let sourceElement: any = null;

      // Try to get the source element from the texture
      if (texture.source && texture.source.data) {
        sourceElement = texture.source.data;
      } else if ((texture as any).image) {
        sourceElement = (texture as any).image;
      }

      if (!sourceElement) {
        return null;
      }

      // Set canvas size for thumbnail (max 200x200)
      const maxSize = 200;
      let width = 0;
      let height = 0;

      // Get dimensions based on source type
      if (sourceElement instanceof HTMLCanvasElement) {
        width = sourceElement.width;
        height = sourceElement.height;
      } else if (sourceElement instanceof ImageData) {
        width = sourceElement.width;
        height = sourceElement.height;
      } else if (sourceElement instanceof HTMLVideoElement) {
        width = sourceElement.videoWidth || sourceElement.width;
        height = sourceElement.videoHeight || sourceElement.height;
      } else if (sourceElement.constructor.name === "ImageBitmap") {
        width = (sourceElement as any).width;
        height = (sourceElement as any).height;
      } else if (sourceElement instanceof HTMLImageElement) {
        width = sourceElement.naturalWidth || sourceElement.width;
        height = sourceElement.naturalHeight || sourceElement.height;
      }

      if (width === 0 || height === 0) {
        return null;
      }

      // Calculate thumbnail dimensions maintaining aspect ratio
      const scale = Math.min(maxSize / width, maxSize / height);
      canvas.width = Math.floor(width * scale);
      canvas.height = Math.floor(height * scale);

      // Draw the texture to canvas
      if (sourceElement instanceof ImageData) {
        // Create a temporary canvas for ImageData
        const tempCanvas = document.createElement("canvas");
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          tempCanvas.width = sourceElement.width;
          tempCanvas.height = sourceElement.height;
          tempCtx.putImageData(sourceElement, 0, 0);
          ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
        }
      } else if (
        sourceElement instanceof HTMLCanvasElement ||
        sourceElement instanceof HTMLImageElement ||
        sourceElement instanceof HTMLVideoElement ||
        sourceElement.constructor.name === "ImageBitmap"
      ) {
        ctx.drawImage(sourceElement, 0, 0, canvas.width, canvas.height);
      } else {
        return null;
      }

      // Convert to base64 data URI
      return canvas.toDataURL("image/png");
    } catch (error) {
      console.warn("Error creating texture thumbnail:", error);
      return null;
    }
  }

  private static createCompressedTextureThumbnail(texture: THREE.Texture): string | null {
    let renderer: THREE.WebGLRenderer | null = null;

    try {
      // Get texture dimensions
      const textureAny = texture as any;
      let width = 0;
      let height = 0;

      if (textureAny.mipmaps && textureAny.mipmaps.length > 0) {
        width = textureAny.mipmaps[0].width || 0;
        height = textureAny.mipmaps[0].height || 0;
      }

      if (width === 0 || (height === 0 && textureAny.image)) {
        width = textureAny.image.width || 0;
        height = textureAny.image.height || 0;
      }

      if (width === 0 || height === 0) {
        return null;
      }

      // Calculate thumbnail dimensions maintaining aspect ratio
      const maxSize = 200;
      const scale = Math.min(maxSize / width, maxSize / height);
      const thumbWidth = Math.floor(width * scale);
      const thumbHeight = Math.floor(height * scale);

      // Create a temporary WebGL renderer
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
      renderer.setSize(thumbWidth, thumbHeight);
      renderer.setClearColor(0x000000, 0);

      // Create a simple scene with a plane
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
      camera.position.z = 0.5;

      // Create a plane geometry with the texture
      const geometry = new THREE.PlaneGeometry(1, 1);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
      });
      const plane = new THREE.Mesh(geometry, material);
      scene.add(plane);

      // Render the scene
      renderer.render(scene, camera);

      // Get the canvas and convert to data URL
      const canvas = renderer.domElement;
      const dataURL = canvas.toDataURL("image/png");

      // Clean up
      geometry.dispose();
      material.dispose();

      return dataURL;
    } catch (error) {
      console.warn("Error creating compressed texture thumbnail:", error);
      return null;
    } finally {
      if (renderer) {
        renderer.dispose();
      }
    }
  }

  private static createGeometryPreview(
    geometry: THREE.BufferGeometry,
    renderer: THREE.WebGLRenderer,
  ): string | null {
    try {
      // Create a temporary scene for rendering
      const tempScene = new THREE.Scene();
      const tempCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);

      // Ensure renderer is configured for preview
      renderer.setSize(200, 200);
      renderer.setClearColor(0x222222, 0);

      // Create a mesh with a light gray material and overlay wireframe lines
      const material = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
      const mesh = new THREE.Mesh(geometry, material);
      const wireGeom = new THREE.WireframeGeometry(geometry);
      const wireMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
      const wireframe = new THREE.LineSegments(wireGeom, wireMaterial);
      wireframe.renderOrder = 1;

      // Prefer tight fit using bounding sphere; fallback to bounding box
      geometry.computeBoundingSphere();
      let radius = 0;
      let center = new THREE.Vector3();
      if (geometry.boundingSphere) {
        radius = geometry.boundingSphere.radius;
        center.copy(geometry.boundingSphere.center);
      } else {
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        if (!box) {
          return null;
        }
        center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        radius = Math.max(size.x, size.y, size.z) * 0.5;
      }

      // Center geometry at origin
      mesh.position.sub(center);
      wireframe.position.copy(mesh.position);

      // Compute camera distance to tightly fit the sphere within the vertical FOV
      const fovRad = (tempCamera.fov * Math.PI) / 180;
      let distance = radius / Math.sin(fovRad / 2);
      // Add a small margin to avoid clipping while keeping it tight
      distance *= 1.05;

      // Place camera along an isometric direction at the computed distance
      const dir = new THREE.Vector3(1, 1, 1).normalize();
      tempCamera.position.copy(dir.multiplyScalar(distance));
      tempCamera.lookAt(0, 0, 0);

      // Add lighting
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1);

      tempScene.add(mesh);
      tempScene.add(wireframe);
      tempScene.add(ambientLight);
      tempScene.add(directionalLight);

      // Render the scene
      renderer.render(tempScene, tempCamera);

      // Get the canvas and convert to data URL
      const canvas = renderer.domElement;
      const dataURL = canvas.toDataURL("image/png");

      // Clean up
      material.dispose();
      wireMaterial.dispose();
      wireGeom.dispose();

      return dataURL;
    } catch (error) {
      console.warn("Error creating geometry preview:", error);
      return null;
    }
  }

  private static buildReportUI(
    doc: Document,
    geometries: Map<string, GeometryInfo>,
    textures: Map<string, TextureInfo>,
    materials: Map<string, MaterialInfo>,
    stats: MemoryStats,
    textureThumbnails: Map<string, string>,
    geometryPreviews: Map<string, string>,
  ): void {
    // Set document title
    doc.title = "Three.js Memory Report";

    // Add styles
    const style = doc.createElement("style");
    style.textContent = ThreeJSMemoryInspector.getReportStyles();
    doc.head.appendChild(style);

    // Clear body
    doc.body.innerHTML = "";

    // Create container
    const container = doc.createElement("div");
    container.className = "container";

    // Create stats grid
    const statsGrid = ThreeJSMemoryInspector.createStatsGrid(doc, stats);
    container.appendChild(statsGrid);

    // Create main section
    const section = doc.createElement("div");
    section.className = "section";

    // Create controls
    const controls = ThreeJSMemoryInspector.createControls(doc, stats);
    section.appendChild(controls);

    // Create content area
    const sectionContent = doc.createElement("div");
    sectionContent.className = "section-content";

    const resultsInfo = doc.createElement("div");
    resultsInfo.className = "results-info";
    resultsInfo.id = "resultsInfo";
    sectionContent.appendChild(resultsInfo);

    const itemList = doc.createElement("div");
    itemList.className = "item-list";
    itemList.id = "itemList";
    sectionContent.appendChild(itemList);

    section.appendChild(sectionContent);
    container.appendChild(section);

    doc.body.appendChild(container);

    // Initialize interactivity
    ThreeJSMemoryInspector.initializeReportInteractivity(
      doc,
      geometries,
      textures,
      textureThumbnails,
      geometryPreviews,
    );
  }

  private static getReportStyles(): string {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a1a;
            color: #e0e0e0;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .stat-card {
            background: #2a2a2a;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #444;
        }
        
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #4CAF50;
            margin-bottom: 5px;
        }
        
        .stat-label {
            color: #aaa;
            font-size: 0.9em;
        }
        
        .section {
            background: #2a2a2a;
            border-radius: 8px;
            margin-bottom: 30px;
            overflow: hidden;
            border: 1px solid #444;
        }
        
        .section-content {
            padding: 20px;
        }
        
        .controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            padding: 16px 20px;
            background: #333;
            border-bottom: 1px solid #444;
        }
        .control-group {
            display: flex;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
        }
        .checkbox {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #2a2a2a;
            padding: 6px 10px;
            border: 1px solid #555;
            border-radius: 6px;
        }
        .filter-bar {
            display: flex;
            align-items: center;
            gap: 12px;
            color: #ccc;
        }
        .clear-btn {
            background: transparent;
            border: 1px solid #666;
            color: #ccc;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
        }
        .clear-btn:hover { border-color: #888; color: #fff; }

        .item-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .item-row {
            display: flex;
            gap: 12px;
            align-items: center;
            background: #333;
            border: 1px solid #555;
            border-radius: 8px;
            padding: 12px;
        }
        .item-media {
            flex: 0 0 160px;
            height: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #222;
            border: 1px solid #555;
            border-radius: 6px;
            overflow: hidden;
        }
        .item-media img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .item-media .placeholder { color: #666; font-size: 0.85em; text-align: center; padding: 0 8px; }
        .item-content { flex: 1; min-width: 0; }
        .item-title { display: flex; gap: 10px; align-items: center; margin-bottom: 6px; }
        .item-name { font-weight: bold; color: #fff; font-size: 1.05em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .type-badge { font-size: 0.75em; padding: 2px 6px; border-radius: 4px; border: 1px solid #555; color: #ddd; }
        .type-geometry { background: #263238; }
        .type-texture { background: #2e3a29; }
        .item-details { color: #ccc; font-size: 0.9em; }
        .item-detail-line { margin-bottom: 2px; }
        .item-meta { min-width: 140px; text-align: right; }
        .item-size { background: #4CAF50; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; display: inline-block; }
        .item-usage { margin-top: 8px; color: #aaa; font-size: 0.85em; }
        .usage-list { margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap; }
        .usage-chip { background: #444; color: #ddd; border: 1px solid #666; border-radius: 14px; padding: 2px 8px; font-size: 0.75em; cursor: pointer; }
        .usage-chip:hover { background: #4a4a4a; border-color: #888; color: #fff; }
        .results-info { color: #aaa; font-size: 0.85em; margin-bottom: 12px; }
        .loading {
            text-align: center;
            color: #666;
            font-style: italic;
        }
        .more-items {
            color: #888;
            font-size: 0.75em;
            margin-left: 4px;
        }
    `;
  }

  private static createStatsGrid(doc: Document, stats: MemoryStats): HTMLElement {
    const statsGrid = doc.createElement("div");
    statsGrid.className = "stats-grid";

    const formatBytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

    // Total Memory card
    statsGrid.appendChild(
      ThreeJSMemoryInspector.createStatCard(doc, formatBytes(stats.totalMemory), "Total Memory"),
    );

    // Geometry Memory card
    statsGrid.appendChild(
      ThreeJSMemoryInspector.createStatCard(
        doc,
        formatBytes(stats.totalGeometryMemory),
        "Geometry Memory",
      ),
    );

    // Texture Memory card
    statsGrid.appendChild(
      ThreeJSMemoryInspector.createStatCard(
        doc,
        formatBytes(stats.totalTextureMemory),
        "Texture Memory",
      ),
    );

    // Geometries count card
    statsGrid.appendChild(
      ThreeJSMemoryInspector.createStatCard(doc, String(stats.geometryCount), "Geometries"),
    );

    // Textures count card
    statsGrid.appendChild(
      ThreeJSMemoryInspector.createStatCard(doc, String(stats.textureCount), "Textures"),
    );

    return statsGrid;
  }

  private static createStatCard(doc: Document, value: string, label: string): HTMLElement {
    const card = doc.createElement("div");
    card.className = "stat-card";

    const valueDiv = doc.createElement("div");
    valueDiv.className = "stat-value";
    valueDiv.textContent = value;
    card.appendChild(valueDiv);

    const labelDiv = doc.createElement("div");
    labelDiv.className = "stat-label";
    labelDiv.textContent = label;
    card.appendChild(labelDiv);

    return card;
  }

  private static createControls(doc: Document, stats: MemoryStats): HTMLElement {
    const controls = doc.createElement("div");
    controls.className = "controls";

    // Control group (checkboxes)
    const controlGroup = doc.createElement("div");
    controlGroup.className = "control-group";

    // Textures checkbox
    const texturesLabel = doc.createElement("label");
    texturesLabel.className = "checkbox";

    const texturesCheckbox = doc.createElement("input");
    texturesCheckbox.type = "checkbox";
    texturesCheckbox.id = "toggleTextures";
    texturesCheckbox.checked = true;
    texturesLabel.appendChild(texturesCheckbox);

    texturesLabel.appendChild(doc.createTextNode(` Textures (${stats.textureCount})`));
    controlGroup.appendChild(texturesLabel);

    // Geometries checkbox
    const geometriesLabel = doc.createElement("label");
    geometriesLabel.className = "checkbox";

    const geometriesCheckbox = doc.createElement("input");
    geometriesCheckbox.type = "checkbox";
    geometriesCheckbox.id = "toggleGeometries";
    geometriesCheckbox.checked = true;
    geometriesLabel.appendChild(geometriesCheckbox);

    geometriesLabel.appendChild(doc.createTextNode(` Geometries (${stats.geometryCount})`));
    controlGroup.appendChild(geometriesLabel);

    controls.appendChild(controlGroup);

    // Filter bar
    const filterBar = doc.createElement("div");
    filterBar.className = "filter-bar";

    const filterStatus = doc.createElement("span");
    filterStatus.id = "filterStatus";
    filterStatus.textContent = "No object filter";
    filterBar.appendChild(filterStatus);

    const clearButton = doc.createElement("button");
    clearButton.id = "clearFilter";
    clearButton.className = "clear-btn";
    clearButton.textContent = "Clear filter";
    clearButton.style.display = "none";
    filterBar.appendChild(clearButton);

    controls.appendChild(filterBar);

    return controls;
  }

  private static initializeReportInteractivity(
    doc: Document,
    geometries: Map<string, GeometryInfo>,
    textures: Map<string, TextureInfo>,
    textureThumbnails: Map<string, string>,
    geometryPreviews: Map<string, string>,
  ): void {
    // Prepare data arrays
    const texturesData = Array.from(textures.values())
      .map((tex) => ({
        type: "texture" as const,
        uuid: tex.uuid,
        name: tex.name,
        memoryBytes: tex.memoryBytes,
        width: tex.width,
        height: tex.height,
        format: tex.format,
        sourceType: tex.sourceType,
        url: tex.url,
        usedByObjects: tex.usedByObjects,
        usedByObjectPaths: tex.usedByObjectPaths,
        usedByObjectInstanceIds: tex.usedByObjectInstanceIds,
        instanceCount: tex.usedByObjectInstanceIds.length,
        thumbnail: textureThumbnails.get(tex.uuid) || null,
      }))
      .sort((a, b) => b.memoryBytes - a.memoryBytes);

    const geometriesData = Array.from(geometries.values())
      .map((geo) => ({
        type: "geometry" as const,
        uuid: geo.uuid,
        name: geo.name,
        memoryBytes: geo.memoryBytes,
        vertexCount: geo.vertexCount,
        triangleCount: geo.triangleCount,
        usedByObjects: geo.usedByObjects,
        usedByObjectPaths: geo.objectPaths,
        usedByObjectInstanceIds: geo.usedByObjectInstanceIds,
        instanceCount: geo.usedByObjectInstanceIds.length,
        preview: geometryPreviews.get(geo.uuid) || null,
      }))
      .sort((a, b) => b.memoryBytes - a.memoryBytes);

    const itemList = doc.getElementById("itemList");
    const resultsInfo = doc.getElementById("resultsInfo");
    const toggleTextures = doc.getElementById("toggleTextures") as HTMLInputElement | null;
    const toggleGeometries = doc.getElementById("toggleGeometries") as HTMLInputElement | null;
    const filterStatus = doc.getElementById("filterStatus");
    const clearFilterBtn = doc.getElementById("clearFilter");

    if (!itemList || !resultsInfo || !filterStatus || !clearFilterBtn) {
      return;
    }

    let activeObjectFilter: string | null = null;

    const formatBytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

    const render = () => {
      const includeTextures = toggleTextures?.checked ?? true;
      const includeGeometries = toggleGeometries?.checked ?? true;

      let items: Array<(typeof texturesData)[0] | (typeof geometriesData)[0]> = [];
      if (includeTextures) items.push(...texturesData);
      if (includeGeometries) items.push(...geometriesData);

      const total = items.length;

      if (activeObjectFilter) {
        items = items.filter((item) => item.usedByObjectInstanceIds.includes(activeObjectFilter!));
      }

      items.sort((a, b) => b.memoryBytes - a.memoryBytes);

      // Clear item list
      itemList.innerHTML = "";

      if (items.length === 0) {
        const loading = doc.createElement("div");
        loading.className = "loading";
        loading.textContent = "No items match the current filters.";
        itemList.appendChild(loading);
      } else {
        items.forEach((item) => {
          const itemRow = ThreeJSMemoryInspector.createItemRow(
            doc,
            item,
            formatBytes,
            (objectId: string) => {
              activeObjectFilter = objectId;
              updateFilterBar();
              render();
            },
          );
          itemList.appendChild(itemRow);
        });
      }

      resultsInfo.textContent = `Showing ${items.length} of ${total} item(s)`;
    };

    const updateFilterBar = () => {
      console.log("updateFilterBar", activeObjectFilter);
      if (activeObjectFilter) {
        filterStatus.textContent = `Object filter: ${activeObjectFilter}`;
        clearFilterBtn.style.display = "";
      } else {
        filterStatus.textContent = "No object filter";
        clearFilterBtn.style.display = "none";
      }
    };

    // Event listeners
    toggleTextures?.addEventListener("change", render);
    toggleGeometries?.addEventListener("change", render);
    clearFilterBtn.addEventListener("click", () => {
      activeObjectFilter = null;
      updateFilterBar();
      render();
    });

    // Initial render
    updateFilterBar();
    render();
  }

  private static createItemRow(
    doc: Document,
    item: any,
    formatBytes: (bytes: number) => string,
    onObjectClick: (objectId: string) => void,
  ): HTMLElement {
    const itemRow = doc.createElement("div");
    itemRow.className = "item-row";

    // Media section
    const itemMedia = doc.createElement("div");
    itemMedia.className = "item-media";

    const isTexture = item.type === "texture";
    const mediaSource = isTexture ? item.thumbnail : item.preview;

    if (mediaSource) {
      const img = doc.createElement("img");
      img.src = mediaSource;
      img.alt = item.name;
      itemMedia.appendChild(img);
    } else {
      const placeholder = doc.createElement("div");
      placeholder.className = "placeholder";
      placeholder.textContent = isTexture
        ? `${item.width} × ${item.height}`
        : `${item.vertexCount.toLocaleString()} vertices`;
      itemMedia.appendChild(placeholder);
    }

    itemRow.appendChild(itemMedia);

    // Content section
    const itemContent = doc.createElement("div");
    itemContent.className = "item-content";

    // Title
    const itemTitle = doc.createElement("div");
    itemTitle.className = "item-title";

    const itemName = doc.createElement("div");
    itemName.className = "item-name";
    itemName.textContent = item.name;
    itemTitle.appendChild(itemName);

    const typeBadge = doc.createElement("div");
    typeBadge.className = `type-badge ${isTexture ? "type-texture" : "type-geometry"}`;
    typeBadge.textContent = isTexture ? "Texture" : "Geometry";
    itemTitle.appendChild(typeBadge);

    itemContent.appendChild(itemTitle);

    // Details
    const itemDetails = doc.createElement("div");
    itemDetails.className = "item-details";

    if (isTexture) {
      const line1 = doc.createElement("div");
      line1.className = "item-detail-line";
      line1.textContent = `${item.width} × ${item.height} • ${item.format}`;
      itemDetails.appendChild(line1);

      const line2 = doc.createElement("div");
      line2.className = "item-detail-line";
      line2.textContent = `Source: ${item.sourceType}`;
      itemDetails.appendChild(line2);

      if (item.url) {
        const line3 = doc.createElement("div");
        line3.className = "item-detail-line";
        line3.textContent = `URL: ${item.url}`;
        itemDetails.appendChild(line3);
      }
    } else {
      const line1 = doc.createElement("div");
      line1.className = "item-detail-line";
      line1.textContent = `${item.vertexCount.toLocaleString()} vertices • ${item.triangleCount.toLocaleString()} triangles`;
      itemDetails.appendChild(line1);
    }

    itemContent.appendChild(itemDetails);

    // Usage section
    const itemUsage = doc.createElement("div");
    itemUsage.className = "item-usage";

    const usageLabel = doc.createElement("div");
    usageLabel.textContent = `Used by ${item.usedByObjects.length} object(s):`;
    itemUsage.appendChild(usageLabel);

    const usageList = doc.createElement("div");
    usageList.className = "usage-list";

    const maxChips = 10;
    const objectsToShow = item.usedByObjects.slice(0, maxChips);

    objectsToShow.forEach((objName: string, idx: number) => {
      const chip = doc.createElement("button");
      chip.className = "usage-chip";
      chip.type = "button";
      chip.textContent = objName;
      chip.title = item.usedByObjectPaths[idx] || objName;
      chip.addEventListener("click", () => {
        onObjectClick(item.usedByObjectInstanceIds[idx]);
      });
      usageList.appendChild(chip);
    });

    if (item.usedByObjects.length > maxChips) {
      const more = doc.createElement("span");
      more.className = "more-items";
      more.textContent = `+${item.usedByObjects.length - maxChips} more`;
      usageList.appendChild(more);
    }

    itemUsage.appendChild(usageList);
    itemContent.appendChild(itemUsage);

    itemRow.appendChild(itemContent);

    // Meta section
    const itemMeta = doc.createElement("div");
    itemMeta.className = "item-meta";

    const itemSize = doc.createElement("div");
    itemSize.className = "item-size";
    itemSize.textContent = formatBytes(item.memoryBytes);
    itemMeta.appendChild(itemSize);

    const instanceCount = doc.createElement("div");
    instanceCount.style.marginTop = "6px";
    instanceCount.style.color = "#bbb";
    instanceCount.style.fontSize = "0.8em";
    instanceCount.textContent = `${item.instanceCount} instance(s)`;
    itemMeta.appendChild(instanceCount);

    itemRow.appendChild(itemMeta);

    return itemRow;
  }
}
