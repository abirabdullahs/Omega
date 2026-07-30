export const formatPhoneToEmail = (phone: string) => {
  // Remove any non-numeric characters just in case
  const cleanPhone = phone.replace(/\D/g, "");
  return `${cleanPhone}@mentorship.app`;
};

export const getDefaultPassword = (phone: string) => {
  const cleanPhone = phone.replace(/\D/g, "");
  return cleanPhone.slice(-9);
};
