import { AttributeHandler, parseBoolAttribute } from "../attributes";

const clickableAttributeName = "clickable";
const defaultClickable = true;

/**
 * ClickableHelper is a helper class for MML elements that have a "clickable" attribute that can be changed.
 *
 * It reacts to the attribute values for clickable. It is minimal, but avoids the boilerplate being present in many classes.
 */
export class ClickableHelper {
  private props = {
    clickable: defaultClickable,
  };

  static AttributeHandler = new AttributeHandler<ClickableHelper>({
    [clickableAttributeName]: (instance, newValue) => {
      const clickable = parseBoolAttribute(newValue, defaultClickable);
      if (clickable !== instance.props.clickable) {
        instance.props.clickable = clickable;
      }
    },
  });
  static observedAttributes = ClickableHelper.AttributeHandler.getAttributes();

  constructor() {}

  public isClickable(): boolean {
    return this.props.clickable;
  }

  public handle(name: string, newValue: string) {
    ClickableHelper.AttributeHandler.handle(this, name, newValue);
  }
}
