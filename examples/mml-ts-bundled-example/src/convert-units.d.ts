declare module "convert-units" {
  function convert(value: number): {
    from(unit: string): {
      to(unit: string): number;
    };
  };
  export default convert;
}
