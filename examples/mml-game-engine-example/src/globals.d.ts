declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "*.mml" {
  const content: string;
  export default content;
}

declare module "*.html" {
  const content: string;
  export default content;
}
