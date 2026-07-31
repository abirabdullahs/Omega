export const formatPhoneToEmail = (phone: string) => {
  // Remove any non-numeric characters just in case
  const cleanPhone = phone.replace(/\D/g, "");
  return `${cleanPhone}@mentorship.app`;
};

export const getDefaultPassword = (phone: string) => {
  const cleanPhone = phone.replace(/\D/g, "");
  const password = cleanPhone.slice(-9);
  if (password.length < 6) {
    throw new Error("Phone number must have at least 6 digits for the default password");
  }
  return password;
};
