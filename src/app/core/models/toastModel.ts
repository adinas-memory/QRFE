export interface AppToast {
  id: string;          
  title?: string;
  message: string;
  color?: 'primary'|'success'|'danger'|'info'|'warning'|'light'|'dark';
  autohide?: boolean;
  delay?: number;  
  textWhite?: boolean;    
}
