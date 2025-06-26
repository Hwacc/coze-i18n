import type {
  Box,
  ImageEvent,
  KeyEvent,
  DragEvent as LeaferDragEvent,
  IScreenSizeData,
  IUI,
  LeaferEvent,
  PropertyEvent,
  ILeaferImage,
} from 'leafer-ui'
import { Platform, PointerEvent, Rect, Resource } from 'leafer-ui'
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
import EditorDeleteBtn from './buttons/EditorDeleteBtn'
import EditorInfoBtn from './buttons/EditorInfoBtn'

class Editor extends EditorInteraction {
  private tag: Rect | null = new Rect()

  private imageResource!: ILeaferImage
  private imageSrcSize: { width: number; height: number } = {
    width: 0,
    height: 0,
  }
  private idCounter = 0

  private editorDeleteButton: Box
  private editorInfoButton: Box

  private lineWidth = 2
  private dotMatrix: DotMatrix
  private debounceTagChangeEvent: (action: string, target: IUI) => void

  constructor(view: HTMLDivElement, mode: EditorMode) {
    super(view, mode)
    this.editorDeleteButton = EditorDeleteBtn.one({
      fill: 'red',
      x: 32,
      y: 0,
    }) as Box
    this.editorInfoButton = EditorInfoBtn.one({
      fill: '#4689F5',
      x: 0,
      y: 0,
    }) as Box

    this.editorDeleteButton.on(PointerEvent.TAP, this.onDeleteClick.bind(this))
    this.editorInfoButton.on(PointerEvent.TAP, this.onInfoClick.bind(this))

    this.app.editor.buttons.add(this.editorDeleteButton)
    this.app.editor.buttons.add(this.editorInfoButton)

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
    this.tag = new Rect({
      id: `Tag${this.idCounter++}`,
      className: 'tag',
      fill: 'transparent',
      cornerRadius: 4,
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
      editable: false,
      dragBounds: 'parent',
      widthRange: { min: 20, max: this.image.width },
      heightRange: { min: 20, max: this.image.height },
    })
    this.registerTagEvents(this.tag)
    this.groupTag.add(this.tag)
  }
  override onGroupDrag(e: LeaferDragEvent) {
    if (this.mode !== 'draw') return
    if (this.tag) {
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
      this.tag.set({ x, y, width, height })
    }
  }
  override onGroupDragEnd() {
    if (this.mode !== 'draw') return
    if (this.tag) {
      this.app.editor.visible = true
      this.app.editor.hittable = true
      this.tag.set({ editable: true })
      const { width = 0, height = 0 } = this.tag
      if (width <= 10 || height <= 10) {
        this.tag.remove()
      } else {
        this.emit('tag-add', this.tag.toJSON())
      }
    }
    this.tag = null
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

  cliper:Rect | null = null
  override onEditorSelect() {
    if (!isEmpty(this.app.editor.list)) {
      const selectedOne = this.app.editor.list[0]
      this.emit('tag-select', selectedOne.toJSON())
      console.log('resource url', this.imageResource.url, this.image.url)
      this.cliper = new Rect({
        width: selectedOne.width,
        height: selectedOne.height,
        x: 0,
        y: 0,
        stroke: 'black',
        strokeWidth: 2,
        offsetX: -(selectedOne.width ?? 0),
        offsetY: -(selectedOne.height ?? 0),
        fill: {
          type: 'image',
          url: this.imageResource.url,
          mode: 'clip',
          repeat: false,
          offset: { x: -(selectedOne.width ?? 0), y: -(selectedOne.height ?? 0) },
        },
      })
      this.groupTree.add(this.cliper)
    } else {
      if (this.cliper) {
        this.groupTree.remove(this.cliper)
        this.cliper.destroy()
      }
    }
  }

  private onDeleteClick() {
    if (isEmpty(this.app.editor.list)) return
    const target = this.app.editor.list.pop()
    this.emit('tag-remove', target?.toJSON())
    target?.remove()
    this.app.editor.target = undefined
  }

  private onInfoClick() {
    if (!isEmpty(this.app.editor.list)) {
      this.emit('tag-info', this.app.editor.list[0].toJSON())
    }
  }

  private registerTagEvents(tag: Rect) {
    tag.on(PointerEvent.TAP, () => {
      this.emit('tag-click', tag.toJSON())
    })
    tag.on(PointerEvent.DOUBLE_TAP, () => this.onInfoClick())
  }

  private renderTags(tags: ITag[]) {
    if (isEmpty(tags)) return
    this.groupTag.clear()
    tags.forEach((tag) => {
      const graphicTag = new Rect({
        id: tag.tagID,
        className: tag.className,
        fill: tag.style.fill,
        cornerRadius: tag.style.cornerRadius,
        stroke: tag.style.stroke,
        strokeWidth: tag.style.strokeWidth,
        editable: tag.editable,
        x: tag.x,
        y: tag.y,
        width: tag.width,
        height: tag.height,
        dragBounds: 'parent',
        widthRange: { min: 20, max: this.image.width },
        heightRange: { min: 20, max: this.image.height },
      })
      this.groupTag.add(graphicTag)
      this.registerTagEvents(graphicTag)
    })
  }

  public resize(size: IScreenSizeData) {
    this.app.resize(size)
  }

  public setImage(url: string) {
    this.image.set({ url })
    Platform.origin?.loadImage(url).then((img) => {
      const canvas = document.createElement('canvas') // 原始画布 //
      canvas.width = img.width
      canvas.height = img.height
      canvas.getContext('2d')?.drawImage(img, 0, 0)
      this.imageResource = Resource.setImage('leafer://image.jpg', canvas)
    })
  }

  public autoFitImage() {
    const containerWidth = this.app.tree.width ?? this.view.offsetWidth
    const imageWidth = this.image.width ?? this.imageSrcSize.width

    if (imageWidth > containerWidth) {
      this.app.tree.set({
        origin: 'top-left',
      })
      this.app.tree.zoom('fit-width', 50)
    } else {
      this.app.tree.set({
        x: (containerWidth - imageWidth) / 2,
        y: 50,
        origin: 'top',
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
