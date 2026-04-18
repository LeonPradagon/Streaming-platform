import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

/**
 * Premium SweetAlert2 instances for the Admin Panel
 */
export const adminAlert = {
  success: (title: string, text?: string) => {
    return MySwal.fire({
      icon: 'success',
      title,
      text,
      background: '#0f172a',
      color: '#f8fafc',
      confirmButtonColor: '#eab308',
      timer: 3000,
      timerProgressBar: true,
    });
  },
  
  error: (title: string, text?: string) => {
    return MySwal.fire({
      icon: 'error',
      title,
      text,
      background: '#0f172a',
      color: '#f8fafc',
      confirmButtonColor: '#ef4444',
    });
  },
  
  loading: (title: string, text?: string) => {
    return MySwal.fire({
      title,
      text,
      background: '#0f172a',
      color: '#f8fafc',
      allowOutsideClick: false,
      didOpen: () => {
        MySwal.showLoading();
      },
    });
  },
  
  confirm: (title: string, text: string, confirmText: string = 'Ya, Lanjutkan') => {
    return MySwal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#334155',
      confirmButtonText: confirmText,
      cancelButtonText: 'Batal',
      background: '#0f172a',
      color: '#f8fafc',
    });
  },
  
  close: () => {
    MySwal.close();
  }
};

export default MySwal;
