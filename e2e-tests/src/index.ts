



import { EditableNetworkedDOM, LocalObservableDomFactory } from "@mml-io/networked-dom-server";








const documents: { [key: string]: { documentPath: string; document: EditableNetworkedDOM } } = {};

const watchPath = path.resolve(srcPath, "*.html");
const watcher = chokidar.watch(watchPath, { ignored: /^\./, persistent: true });
watcher
  .on("add", (relativeFilePath) => {
    const filename = path.basename(relativeFilePath);
    console.log("File", filename, "has been added");
    const contents = fs.readFileSync(relativeFilePath, { encoding: "utf8", flag: "r" });

      url.pathToFileURL(filename).toString(),


    document.load(contents);


      documentPath: filename,


    documents[filename] = currentData;
  })
  .on("change", (relativeFilePath) => {
    const filename = path.basename(relativeFilePath);
    console.log("File", filename, "has been changed");
    const contents = fs.readFileSync(relativeFilePath, { encoding: "utf8", flag: "r" });
    const document = documents[filename].document;
    document.load(contents);
  })
  .on("unlink", (relativeFilePath) => {
    const filename = path.basename(relativeFilePath);
    console.log("File", filename, "has been removed");
    const document = documents[filename].document;
    document.dispose();
    delete documents[filename];
  })
  .on("error", (error) => {
    console.error("Error whilst watching directory", error);
  });






  }/${req.params.documentPath}`;




// Allow all origins
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});






        .map(({ documentPath }) => `<p><a href="/${documentPath}">${documentPath}</a></p>`)




app.use("/assets", express.static("./src/assets"));

















app.get("/:documentPath/", (req, res) => {
  const html = `<html><script src="http://${
    req.hostname
  }:28891/index.js?defineGlobals=true&websocketUrl=${getWebsocketUrl(req)}"></script></html>`;




app.get("/:documentPath/reset", (req, res) => {
  const { documentPath } = req.params;

  const currentDocument = documents[documentPath]?.document;


    res.status(404).send(`Document not found: ${documentPath}`);




  res.redirect("/" + documentPath);





