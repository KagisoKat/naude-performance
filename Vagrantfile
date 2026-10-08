Vagrant.configure("2") do |config|

  # Ubuntu operating system image
  config.vm.box = "ubuntu/jammy64"

  # Give the VM a readable name
  config.vm.hostname = "naude-dev"

  # Private network address
  config.vm.network "private_network", ip: "192.168.56.10"

  # Synchronise our project directory
  config.vm.synced_folder ".", "/home/vagrant/naude"

  # Configure VirtualBox
  config.vm.provider "virtualbox" do |vb|
    vb.name = "naude-dev"
    vb.memory = "4096"
    vb.cpus = 2
  end

end