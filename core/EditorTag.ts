import type { ITag } from '~/types/Tag'
import { Frame, Text, type IJSONOptions } from 'leafer-ui'
import { isEmpty, pick } from 'lodash-es'
import {
  DEFAULT_LINE_COLOR,
  DEFAULT_LINE_WIDTH,
  DEFAULT_CORNER_RADIUS,
} from '~/constants'
import { Editor } from './Editor'

class EditorTag extends Frame {
  public remoteTag: Partial<ITag> = {} as ITag
  public isLocked: boolean = false
  private textNode: Text | null = null

  constructor(tag: Partial<ITag>) {
    super({
      id: tag.tagID,
      className: tag.className,
      x: tag.x,
      y: tag.y,
      overflow: 'show',
      width: tag.width,
      height: tag.height,
      fill: tag.style?.fill ?? 'transparent',
      cornerRadius: tag.style?.cornerRadius ?? DEFAULT_CORNER_RADIUS,
      stroke: tag.style?.stroke ?? DEFAULT_LINE_COLOR,
      strokeWidth: tag.style?.strokeWidth ?? DEFAULT_LINE_WIDTH,
      dragBounds: 'parent',
      editable: true,
      editConfig: {
        moveable: !tag.locked,
        rotatable: !tag.locked,
        resizeable: !tag.locked,
      },
      event: {
        mounted: () => {
          if (this.parent) {
            this.set({
              widthRange: { min: 20, max: this.parent.width },
              heightRange: { min: 20, max: this.parent.height },
            })
          }
        },
      },
    })

    this.remoteTag = tag
    this.isLocked = tag.locked ?? false
    this.set({
      widthRange: { min: 20, max: Infinity },
      heightRange: { min: 20, max: Infinity },
    })

    this.drawI18nKey(tag.style?.text)
  }

  private drawI18nKey(textStyle?: ITag['style']['text']) {
    if (!this.remoteTag.i18nKey) {
      if (this.textNode) {
        this.textNode.remove()
        this.textNode = null
      }
      return
    }
    const textOptions = {
      text: this.remoteTag.i18nKey ?? '',
      fontSize: textStyle?.fontSize ?? 14,
      fontWeight: textStyle?.fontWeight ?? 'bold',
      textWrap: textStyle?.wrap ?? 'none',
      fill: textStyle?.fill ?? 'red',
    }
    if (!this.textNode) {
      this.textNode = new Text(textOptions)
      this.add(this.textNode)
    } else {
      this.textNode.set(textOptions)
    }
    this.textNode.set({
      x: (this.remoteTag.width ?? 0) - (this.textNode.width ?? 0),
      y: -(this.textNode.height ?? 0) - 2,
    })
  }

  public lock(_lock: boolean) {
    this.isLocked = _lock
    this.set({
      editConfig: {
        moveable: !_lock,
        rotatable: !_lock,
        resizeable: !_lock,
      },
    })
    this.emit('custom-lock', { locked: _lock })
  }

  public update(rTag: Partial<ITag>) {
    this.remoteTag = { ...this.remoteTag, ...rTag }
    this.updateStyle(rTag.style)
    this.drawI18nKey(rTag.style?.text)
  }

  public updateStyle(rStyle: Partial<ITag['style']> | undefined) {
    if (isEmpty(rStyle)) return
    this.set({
      fill: rStyle.fill ?? 'transparent',
      cornerRadius: rStyle.cornerRadius ?? DEFAULT_CORNER_RADIUS,
      stroke: rStyle.stroke ?? DEFAULT_LINE_COLOR,
      strokeWidth: rStyle.strokeWidth ?? DEFAULT_LINE_WIDTH,
    })
  }

  public async clip() {
    const image = await Editor.imageClipper.clip({
      x: this.x ?? 0,
      y: this.y ?? 0,
      width: this.width ?? 0,
      height: this.height ?? 0,
    })
    return { image, tag: this.toJSON() }
  }

  public toTagJSON(options?: IJSONOptions): ITag {
    const original = super.toJSON(options)
    const text = this.textNode?.toJSON()
    const baseProps = pick(original, [
      'x',
      'y',
      'width',
      'height',
      'className',
      'tag',
      'translationID',
      'translation',
    ])
    const styleProps = pick(original, [
      'fill',
      'cornerRadius',
      'strokeWidth',
      'stroke',
    ]) as ITag['style']
    if (text) {
      styleProps.text = pick(text, [
        'fontSize',
        'fontWeight',
        'fill',
        'wrap',
        'align',
      ])
    }
    this.remoteTag.tagID = this.id
    this.remoteTag.style = { ...styleProps } as unknown as ITag['style']
    this.remoteTag.locked = this.isLocked
    return { ...this.remoteTag, ...baseProps } as ITag
  }
}

export default EditorTag
