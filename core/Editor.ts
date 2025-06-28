import type {
  ImageEvent,
  KeyEvent,
  DragEvent as LeaferDragEvent,
  IScreenSizeData,
  IUI,
  LeaferEvent,
  PropertyEvent,
} from 'leafer-ui'
import { PointerEvent } from 'leafer-ui'
import '@leafer-in/view'
import '@leafer-in/viewport'
import '@leafer-in/export'
import { debounce, isEmpty } from 'lodash-es'
import { DotMatrix } from 'leafer-x-dot-matrix'
import type { ITag } from '~/types/interfaces'
import EditorInteraction, { type EditorMode } from './EditorInteraction'
import type {
  EditorMoveEvent,
  EditorRotateEvent,
  EditorScaleEvent,
  EditorSkewEvent,
} from '@leafer-in/editor'
import ImageClipper from './ImageClipper'
import FuncBtnGroup from './buttons/FuncBtnGroup'
import { FuncBtnType } from './buttons/FuncBtn'
import EditorTag from './EditorTag'

class Editor extends EditorInteraction {
  private tempTag: EditorTag | null = null
  private imageSrcSize: { width: number; height: number } = {
    width: 0,
    height: 0,
  }
  private idCounter = 0

  private funcBtnGroup: FuncBtnGroup
  private lineWidth = 2
  private dotMatrix: DotMatrix
  private debounceTagChangeEvent: (action: string, target: IUI) => void

  private imageClipper: ImageClipper

  constructor(view: HTMLDivElement, mode: EditorMode) {
    super(view, mode)

    this.funcBtnGroup = new FuncBtnGroup()
    this.funcBtnGroup.on(
      'btn-click',
      ({ type, payload }: { type: FuncBtnType; payload?: any }) => {
        switch (type) {
          case FuncBtnType.INFO:
            this.onInfoClick()
            break
          case FuncBtnType.OCR:
            this.onOCRClick()
            break
          case FuncBtnType.DELETE:
            this.onDeleteClick()
            break
          case FuncBtnType.LOCK:
            this.onLockClick(payload)
            break
        }
      }
    )

    this.app.editor.buttons.add(this.funcBtnGroup)

    this.dotMatrix = new DotMatrix(this.app)
    this.dotMatrix.enableDotMatrix(true)

    this.idCounter = 0

    this.debounceTagChangeEvent = debounce(
      (action: string, target: IUI) => {
        this.emit('tag-change', { action, tag: target.toJSON() })
      },
      200,
      {
        leading: false,
        trailing: true,
      }
    ).bind(this)

    this.imageClipper = new ImageClipper()
  }

  override onReady(_: LeaferEvent): void {
    this.emit('ready')
  }
  override onPropertyChange(e: PropertyEvent): void {
    if (e.attrName === 'scaleX') {
      this.emit('scale-change', parseFloat((e.newValue as number).toFixed(2)))
    }
  }
  override onImageLoaded(e: ImageEvent) {
    console.log('image loaded', e)

    this.imageSrcSize = {
      width: e.image.width,
      height: e.image.height,
    }
    const initElementsSize = () => {
      this.groupTree.set({
        width: e.image.width,
        height: e.image.height,
        draggable: this.mode === 'drag',
      })

      this.image.set({
        width: e.image.width,
        height: e.image.height,
      })

      this.groupTag.set({
        width: e.image.width,
        height: e.image.height,
        fill: 'transparent',
        zIndex: 10,
      })
      this.autoFitImage()
    }
    if (!this.app.tree.ready) {
      this.app.tree.waitReady(initElementsSize)
    } else {
      initElementsSize()
    }
  }
  override onGroupDragStart() {
    if (this.mode !== 'draw' || !isEmpty(this.app.editor.list)) return
    this.app.editor.visible = false
    this.app.editor.hittable = false
    this.tempTag = new EditorTag({
      tagID: `Tag${this.idCounter++}`,
      className: 'tag',
      style: {
        stroke: {
          type: 'linear',
          from: 'left',
          to: 'right',
          stops: [
            { offset: 0, color: '#FEB027' },
            { offset: 1, color: '#79CB4D' },
          ],
        },
        strokeWidth: this.lineWidth,
      },
    })
    this.tempTag.set({ editable: false })
    this.registerTagEvents(this.tempTag)
    this.groupTag.add(this.tempTag)
  }
  override onGroupDrag(e: LeaferDragEvent) {
    if (this.mode !== 'draw') return
    if (this.tempTag) {
      let { x, y, width, height } = e.getPageBounds()

      const {
        x: imageX,
        y: imageY,
        width: imageWidth,
        height: imageHeight,
      } = this.image.getBounds('box', 'local')

      // 减去groupTree的偏移量
      x = x - (this.groupTree.x ?? 0)
      y = y - (this.groupTree.y ?? 0)

      if (x < imageX) {
        width = width - Math.abs(x)
        x = imageX
      } else if (x + width > imageWidth) {
        width = imageWidth - x
      }
      if (y < imageY) {
        height = height - Math.abs(y)
        y = imageY
      } else if (y + height > imageHeight) {
        height = imageHeight - y
      }
      this.tempTag.set({ x, y, width, height })
    }
  }
  override onGroupDragEnd() {
    if (this.mode !== 'draw') return
    if (this.tempTag) {
      this.app.editor.visible = true
      this.app.editor.hittable = true
      const { width = 0, height = 0 } = this.tempTag
      if (width <= 10 || height <= 10) {
        this.tempTag.remove()
      } else {
        this.tempTag.set({ editable: true })
        this.emit('tag-add', this.tempTag.toJSON())
      }
    }
    this.tempTag = null
  }
  override onKeyDown() {}
  override onKeyUp(e: KeyEvent) {
    const key = e.key
    if (key === 'Delete') {
      this.onDeleteClick()
    }
  }
  override onEditorMove(e: EditorMoveEvent) {
    this.debounceTagChangeEvent('move', e.target)
  }
  override onEditorScale(e: EditorScaleEvent) {
    this.debounceTagChangeEvent('scale', e.target)
  }
  override onEditorRotate(e: EditorRotateEvent) {
    this.debounceTagChangeEvent('rotate', e.target)
  }
  override onEditorSkew(e: EditorSkewEvent) {
    this.debounceTagChangeEvent('skew', e.target)
  }

  override onEditorSelect() {
    if (isEmpty(this.app.editor.list)) return
    const selectedOne = this.app.editor.list[0] as EditorTag
    this.funcBtnGroup.lockBtn.slocked = selectedOne.isLocked
    this.emit('tag-edit-select', selectedOne.toJSON())
  }

  private onDeleteClick() {
    if (isEmpty(this.app.editor.list)) return
    const target = this.app.editor.list.pop()
    this.emit('tag-remove', target?.toJSON())
    target?.remove()
    this.app.editor.target = undefined
  }

  private onInfoClick() {
    if (isEmpty(this.app.editor.list)) return
    this.emit('tag-info', this.app.editor.list[0].toJSON())
  }

  private async onOCRClick() {
    if (isEmpty(this.app.editor.list)) return
    const selectedOne = this.app.editor.list[0]
    const { x, y, width, height } = selectedOne
    const image = await this.imageClipper.clip({
      x: x ?? 0,
      y: y ?? 0,
      width: width ?? 0,
      height: height ?? 0,
    })
    this.emit('tag-ocr', image)
  }

  private onLockClick(payload: any) {
    if (isEmpty(this.app.editor.list)) return
    const selectedOne = this.app.editor.list[0] as EditorTag
    const { locked } = payload || { locked: false }
    selectedOne.lock(locked)
    this.emit('tag-lock')
  }

  private registerTagEvents(tag: EditorTag) {
    tag.on(PointerEvent.TAP, () => {
      this.emit('tag-click', tag.toJSON())
    })
    tag.on(PointerEvent.DOUBLE_TAP, () => this.onInfoClick())
  }

  private renderTags(tags: ITag[]) {
    if (isEmpty(tags)) return
    this.groupTag.clear()
    tags.forEach((tag) => {
      const graphicTag = new EditorTag(tag)
      this.groupTag.add(graphicTag)
      this.registerTagEvents(graphicTag)
    })
  }

  public resize(size: IScreenSizeData) {
    this.app.resize(size)
  }

  public setImage(url: string) {
    this.image.set({ url })
    this.imageClipper.setImage(url)
  }

  public async autoFitImage() {
    const containerWidth = this.app.tree.width ?? this.view.offsetWidth
    const imageWidth = this.image.width ?? this.imageSrcSize.width
    await sleep(100) // 等待下个渲染周期
    if (imageWidth > containerWidth) {
      this.app.tree.set({
        origin: 'top-left',
      })
      this.app.tree.zoom('fit')
    } else {
      this.app.tree.set({
        x: (containerWidth - imageWidth) / 2,
        y: 50,
        origin: 'top-left',
      })
      this.app.tree.set({ scale: 1 })
    }
  }

  public setScale(scale: number) {
    if (!this.app.tree.ready) {
      this.app.tree.waitReady(() => this.app.tree.set({ scale }))
      return
    }
    this.app.tree.set({ scale })
  }

  public setLineWidth(width: number) {
    this.lineWidth = width
  }

  public setTags(tags: ITag[]) {
    if (!this.app.tree.ready) {
      this.app.tree.waitReady(() => this.renderTags(tags))
      return
    }
    this.renderTags(tags)
  }

  public get ready() {
    return this.app.tree.ready
  }
}

export { Editor, type EditorMode }
