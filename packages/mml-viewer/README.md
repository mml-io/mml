# MML Viewer (Alpha)

This package contains the code for the standalone MML viewer that is available at [https://viewer.mml.io/main/v1/](https://viewer.mml.io/main/v1/).

It is continuously deployed from the `main` branch of this repository.

The viewer supports multiple rendering modes including:
* 3D rendering with THREE.js
* 3D rendering with PlayCanvas
* (HTML) Tag rendering

## Usage

The viewer is configured using URL parameters. The UI allows editing of these parameters and will update the URL as you change them.

### Basic Parameters

* `url` - The URL of the MML document to load 
  * can either be a `wss://` for a live document running on a server or a `https://` for a static MML document.
* `renderer`
  * `threejs` - Use the THREE.js renderer
  * `playcanvas` - Use the PlayCanvas renderer
  * `tags` - Use the HTML tag renderer
* `backgroundColor` - The background color of the viewer. By default the viewer is transparent (white when loaded directly).
  * Can be a color name (e.g. `red`), a hex code (e.g. `#ff0000`) or an RGBA value (e.g. `rgba(255,0,0, 0.5)`).
* `cameraMode` - The camera mode to use. This is renderer specific.
  * `orbit` - Orbit camera
  * `drag-fly` - Drag Fly camera - WASD, Shift & Space to move, drag mouse to look. 

More parameters are discoverable in the UI.

### Embedding in an iframe

The viewer can be embedded in an iframe to enable viewing an MML document on another webpage.

You can include the `&noUI=true` parameter to hide the UI to remove the ability to change the parameters.

E.g. to view an MML document at `https://public.mml.io/rgb-cubes.html` in the viewer:

```html
<iframe src="https://viewer.mml.io/main/v1/?url=https://public.mml.io/rgb-cubes.html&renderer=playcanvas&ambientLight=0.25&backgroundColor=rgba(255,128,0,0.5)&cameraMode=orbit&cameraFitContents=true&noUI=true" allowtransparency="true" style="border:0" width="500" height="500"></iframe>
```

**Note** - Whilst the above example `src` does not do this for simplicity, it is recommended to encode the URL being viewed using `encodeURIComponent` to ensure the parameters of that URL are not interpreted as parameters of the viewer.
