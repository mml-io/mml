import { QueryParamState } from "./QueryParamState";
import { FieldDefinition, GroupDefinition } from "./ui/FieldDefinition";
import { UIField } from "./ui/UIField";
import { UIGroup } from "./ui/UIGroup";
import { ViewerUI } from "./ui/ViewerUI";

export class FormIteration {
  private unmatchedFields = new Map<FieldDefinition, UIField>();

  private fields = new Map<FieldDefinition, UIField>();
  private groups = new Map<GroupDefinition, UIGroup>();

  constructor(
    private queryParamState: QueryParamState,
    private viewerUI: ViewerUI,
    previousFormIteration: FormIteration | null,
  ) {
    if (previousFormIteration) {
      this.unmatchedFields = new Map(previousFormIteration.fields);
      this.fields = new Map(previousFormIteration.fields);
    }
  }

  getFieldValue(fieldDefinition: FieldDefinition): string {
    const unmatchedField = this.unmatchedFields.get(fieldDefinition);
    if (unmatchedField) {
      const uiGroup = unmatchedField.group;
      this.groups.set(uiGroup.groupDefinition, uiGroup);
      this.unmatchedFields // We've used this existing field. Mark it as matched.
        .delete(fieldDefinition);
    }
    let field = this.fields.get(fieldDefinition);
    if (!field) {
      // Create a new field
      const groupDefinition = fieldDefinition.groupDefinition;
      let uiGroup = this.groups.get(groupDefinition);
      if (!uiGroup) {
        uiGroup = new UIGroup(groupDefinition);
        this.groups.set(groupDefinition, uiGroup);
        this.viewerUI.addGroup(uiGroup);
      }
      field = new UIField(fieldDefinition, uiGroup);
      uiGroup.addElement(field);
      this.fields.set(fieldDefinition, field);
    }

    const readValue = this.queryParamState.read(fieldDefinition.name);
    if (readValue !== null) {
      field.setValue(readValue);
      return readValue;
    }
    return fieldDefinition.defaultValue.toString();
  }

  private clearUnmatchedFields() {
    for (const field of this.unmatchedFields.values()) {
      field.dispose();
      field.element.remove();
      const group = field.group;
      group.removeElement(field);
      if (group.isEmpty()) {
        group.dispose();
        this.viewerUI.removeGroup(group);
        this.groups.delete(group.groupDefinition);
      }
      this.fields.delete(field.fieldDefinition);
    }
    this.unmatchedFields.clear();
  }

  completed() {
    this.clearUnmatchedFields();
    this.viewerUI.showUnusedParams(Array.from(this.queryParamState.getUnusedParams()));
  }
}
