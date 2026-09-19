package com.fruitninja.hands

import android.content.Context
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager

/** Read-only camera probing. It never opens a camera: CameraX (HandsController) is the sole owner. */
object Cameras {
    enum class LensStatus { OK, NO_CAMERA, DISABLED, ERROR }

    fun lensStatus(context: Context, front: Boolean): LensStatus {
        val manager = context.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
            ?: return LensStatus.ERROR
        val wanted = if (front) CameraCharacteristics.LENS_FACING_FRONT else CameraCharacteristics.LENS_FACING_BACK
        return try {
            val found = manager.cameraIdList.any { id ->
                manager.getCameraCharacteristics(id).get(CameraCharacteristics.LENS_FACING) == wanted
            }
            if (found) LensStatus.OK else LensStatus.NO_CAMERA
        } catch (e: CameraAccessException) {
            if (e.reason == CameraAccessException.CAMERA_DISABLED) LensStatus.DISABLED else LensStatus.ERROR
        } catch (e: RuntimeException) {
            LensStatus.ERROR
        }
    }
}
