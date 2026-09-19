package com.fruitninja.hands

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.FNHandCameraPreviewManagerDelegate
import com.facebook.react.viewmanagers.FNHandCameraPreviewManagerInterface

class HandCameraPreviewManager :
    SimpleViewManager<HandCameraPreviewView>(),
    FNHandCameraPreviewManagerInterface<HandCameraPreviewView> {

    private val delegate = FNHandCameraPreviewManagerDelegate(this)

    override fun getDelegate(): ViewManagerDelegate<HandCameraPreviewView> = delegate

    override fun getName(): String = NAME

    override fun createViewInstance(context: ThemedReactContext): HandCameraPreviewView =
        HandCameraPreviewView(context)

    @ReactProp(name = "scaleType")
    override fun setScaleType(view: HandCameraPreviewView, value: String?) {
        view.setScaleTypeName(value)
    }

    companion object {
        const val NAME = "FNHandCameraPreview"
    }
}
