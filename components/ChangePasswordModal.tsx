
import React, { useState } from 'react';
import { X, Lock, KeyRound, Check, Loader2 } from 'lucide-react';
import { User } from '../types';
import { updateUserPassword } from '../services/mockDataService';

interface Props {
  user: User;
  onClose: () => void;
  onSuccess: () => void; // To trigger logout or notification
}

const ChangePasswordModal: React.FC<Props> = ({ user, onClose, onSuccess }) => {
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (currentPass !== user.password) {
      setError('Mật khẩu hiện tại không đúng.');
      return;
    }

    if (newPass.length < 3) {
      setError('Mật khẩu mới quá ngắn.');
      return;
    }

    if (newPass !== confirmPass) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (newPass === currentPass) {
        setError('Mật khẩu mới không được trùng với mật khẩu cũ.');
        return;
    }

    try {
      setIsLoading(true);
      const success = await updateUserPassword(user.id, newPass);
      
      if (success) {
        alert("Đổi mật khẩu thành công! Dữ liệu đã được đồng bộ.");
        onSuccess();
        onClose();
      } else {
        setError('Có lỗi xảy ra khi cập nhật.');
      }
    } catch (err) {
      setError('Lỗi kết nối đến máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        <div className="p-4 bg-baby-navy flex justify-between items-center border-b border-slate-700">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Lock size={18} className="text-baby-accent"/>
            Đổi Mật Khẩu
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Mật khẩu hiện tại</label>
            <div className="relative">
                <input
                    type="password"
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:border-baby-accent focus:outline-none"
                    placeholder="Nhập mật khẩu cũ"
                    required
                />
                <KeyRound size={16} className="absolute left-3 top-3 text-slate-400"/>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Mật khẩu mới</label>
            <div className="relative">
                <input
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:border-baby-accent focus:outline-none"
                    placeholder="Nhập mật khẩu mới"
                    required
                />
                <Lock size={16} className="absolute left-3 top-3 text-slate-400"/>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Xác nhận mật khẩu mới</label>
            <div className="relative">
                <input
                    type="password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:border-baby-accent focus:outline-none"
                    placeholder="Nhập lại mật khẩu mới"
                    required
                />
                <Check size={16} className="absolute left-3 top-3 text-slate-400"/>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded">{error}</p>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-baby-accent text-white font-bold py-2.5 rounded-lg hover:bg-pink-600 transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : null}
              {isLoading ? 'Đang đồng bộ...' : 'Xác nhận thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
