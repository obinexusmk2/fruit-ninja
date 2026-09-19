package com.fruitninja.hands

import android.content.Context
import android.graphics.Color
import android.view.View
import android.widget.FrameLayout
import androidx.camera.view.PreviewView

/**
 * Hosts a CameraX PreviewView. The view only supplies the preview surface to
 * [HandsController]; it never opens the camera itself, so there is exactly one
 * camera owner. Attaching it while a session runs adds the Preview use case;
 * detaching it removes it again.
 */
class HandCameraPreviewView(context: Context) : FrameLayout(context) {
    private val previewView = PreviewView(context).apply {
        // COMPATIBLE renders through a TextureView, so React views (the transparent
        // game canvas) composite reliably on top of it.
        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
        scaleType = PreviewView.ScaleType.FILL_CENTER
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    }

    init {
        setBackgroundColor(Color.BLACK)
        addView(previewView)
    }

    fun setScaleTypeName(name: String?) {
        previewView.scaleType =
            if (name == "fit") PreviewView.ScaleType.FIT_CENTER else PreviewView.ScaleType.FILL_CENTER
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        HandsRegistry.controller?.attachPreview(previewView.surfaceProvider)
    }

    override fun onDetachedFromWindow() {
        HandsRegistry.controller?.detachPreview(previewView.surfaceProvider)
        super.onDetachedFromWindow()
    }

    // React Native lays this view out itself and suppresses requestLayout(), so
    // the native child must be measured and laid out manually.
    override fun requestLayout() {
        super.requestLayout()
        post(measureAndLayout)
    }

    private val measureAndLayout = Runnable {
        measure(
            View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY),
        )
        layout(left, top, right, bottom)
    }
}
