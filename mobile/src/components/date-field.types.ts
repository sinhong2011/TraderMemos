/** Props shared by `date-field.tsx` and `date-field.ios.tsx`. */
export type DateFieldProps = {
  /** Wall-clock value the control reflects; picks merge into it. */
  selection: Date;
  /** Which pills to draw; on iOS this passes straight to the SwiftUI picker. */
  displayedComponents: ('date' | 'hourAndMinute')[];
  onDateChange: (date: Date) => void;
};
