import { Platform, type Box, type IBoxInputData } from 'leafer-ui'
import { assign } from 'lodash-es'

export type EditorBtnType = 'delete' | 'info'

export default function EditorBtn(type: EditorBtnType) {
  const baseProps = {
    around: 'center',
    cornerRadius: 9999,
    cursor: 'pointer',
  }
  const deleteIcon = {
    tag: 'Image',
    url: Platform.toURL(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from Lucide by Lucide Contributors - https://github.com/lucide-icons/lucide/blob/main/LICENSE --><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 6L6 18M6 6l12 12"/></svg>',
      'svg'
    ),
    width: 18,
    height: 18,
  }
  const infoIcon = {
    tag: 'Image',
    url: Platform.toURL(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from Material Symbols by Google - https://github.com/google/material-design-icons/blob/master/LICENSE --><path fill="currentColor" d="M12 7q-.825 0-1.412-.587T10 5t.588-1.412T12 3t1.413.588T14 5t-.587 1.413T12 7m0 14q-.625 0-1.062-.437T10.5 19.5v-9q0-.625.438-1.062T12 9t1.063.438t.437 1.062v9q0 .625-.437 1.063T12 21"/></svg>',
      'svg'
    ),
    width: 18,
    height: 18,
  }
  return function <T extends { new (...args: any[]): Box }>(constructor: T) {
    return class extends constructor {
      constructor(...args: any[]) {
        const props = args[0] || {}
        let children: any[] = []
        switch (type) {
          case 'delete':
            children = [deleteIcon]
            break
          case 'info':
            children = [infoIcon]
            break
        }
        super(assign({}, baseProps, { children }, props))
      }
      static one(props: IBoxInputData) {
        return new this(props)
      }
    }
  }
}
