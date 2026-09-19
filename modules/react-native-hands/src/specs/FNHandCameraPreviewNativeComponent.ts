import type {CodegenTypes, ViewProps} from 'react-native';
import {codegenNativeComponent} from 'react-native';

export interface NativeProps extends ViewProps {
  /**
   * 'fill' scales the camera image to cover the view (centre crop); 'fit'
   * letterboxes it. The app's coordinate transform must use the same mode.
   */
  scaleType?: CodegenTypes.WithDefault<'fill' | 'fit', 'fill'>;
}

export default codegenNativeComponent<NativeProps>('FNHandCameraPreview');
